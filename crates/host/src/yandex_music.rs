//! Yandex Music web player in a hidden WebView2, outputting audio to cab speakers.

use std::cell::RefCell;
use std::path::Path;

use crate::signin::{self, Confirming, Progress, SignInWindow};
use crate::speakers::{Equalizer, Head, Speaker};
use crate::webview::{self, OffscreenWebView, Stage};

pub const HOME: &str = "https://music.yandex.ru/";

#[derive(Clone, Copy, Debug, Default, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Repeat {
    #[default]
    Off,
    All,
    One,
}

#[derive(Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(tag = "action", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Command {
    Start,
    SignIn,
    SignOut,
    Play,
    Pause,
    Next,
    Previous,
    Seek { seconds: f64 },
    Volume { percent: f64 },
    Fade { level: f64 },
    Shuffle { on: bool },
    Repeat { mode: Repeat },
}

impl Command {
    fn for_page(&self) -> bool {
        !matches!(self, Command::Start | Command::SignIn | Command::SignOut)
    }
}

#[derive(Debug, PartialEq, serde::Serialize)]
#[serde(tag = "action", rename_all = "camelCase")]
enum Cab {
    Speakers { speakers: Option<Vec<Speaker>> },
    Head { head: Head },
    Outside { on: bool, distance: f32 },
    Equalizer { equalizer: Equalizer },
    Spectrum { on: bool },
}

#[derive(Default)]
struct Told {
    speakers: Option<Option<Vec<Speaker>>>,
    head: Option<Head>,
    camera: Option<(bool, f32)>,
    equalizer: Option<Equalizer>,
    spectrum: Option<bool>,
    messages: [Option<String>; 5],
}

#[derive(Clone, Debug, Default, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    #[serde(default)]
    pub id: Option<String>,
    pub title: String,
    #[serde(default)]
    pub artist: String,
    #[serde(default)]
    pub album: Option<String>,
    #[serde(default)]
    pub image: Option<String>,
    #[serde(default)]
    pub duration: f64,
}

#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Playback {
    #[serde(default)]
    pub track: Option<Track>,
    pub playing: bool,
    #[serde(default)]
    pub loading: bool,
    #[serde(default)]
    pub position: f64,
    #[serde(default)]
    pub duration: f64,
    #[serde(default)]
    pub shuffle: bool,
    #[serde(default)]
    pub repeat: Repeat,
    #[serde(default)]
    pub volume: Option<f64>,
}

#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct State {
    pub signed_in: bool,
    pub playing: bool,
    #[serde(default)]
    pub avatar: Option<String>,
}

pub enum Report {
    Spectrum(Vec<u8>),
    State(State),
    SignInWindow(bool),
    Confirming(bool),
    Playback(Option<Box<Playback>>),
}

pub struct YandexMusic {
    view: OffscreenWebView,
    sign_in: RefCell<Option<SignInWindow>>,
    confirming: Confirming,
    pending: RefCell<Vec<Report>>,
    told: RefCell<Told>,
}

impl YandexMusic {
    pub fn view(&self) -> &OffscreenWebView {
        &self.view
    }

    pub fn start(stage: &Stage, width: u32, height: u32, user_data: &Path) -> Result<Self, webview::Error> {
        let view = OffscreenWebView::new(stage, width, height, user_data)?;
        view.log_as("yandex music")?;
        view.show(false)?;
        stage.add(&view, false)?;
        view.add_startup_script(concat!(include_str!("cab_sound.js"), "\n", include_str!("yandex_music.js")))?;
        view.navigate(HOME)?;
        Ok(Self {
            view,
            sign_in: RefCell::new(None),
            confirming: Confirming::default(),
            pending: RefCell::new(Vec::new()),
            told: RefCell::default(),
        })
    }

    pub fn command(&self, command: &Command) -> windows::core::Result<()> {
        match command {
            Command::Start => Ok(()),
            Command::SignIn => {
                self.open_sign_in();
                Ok(())
            }
            Command::SignOut => {
                self.view.delete_cookies()?;
                self.view.navigate(HOME)
            }
            _ if command.for_page() => self.view.post_json(&serde_json::to_string(command).unwrap_or_default()),
            _ => Ok(()),
        }
    }

    fn open_sign_in(&self) {
        let mut sign_in = self.sign_in.borrow_mut();
        if let Some(window) = sign_in.as_ref() {
            window.bring_forward();
            return;
        }
        match SignInWindow::open(self.view.environment(), &signin::YANDEX_MUSIC) {
            Ok(window) => {
                *sign_in = Some(window);
                self.pending.borrow_mut().push(Report::SignInWindow(true));
            }
            Err(e) => crate::startup::mark(&format!("host: Yandex Music sign-in window couldn't open: {e}")),
        }
    }

    pub fn cab(
        &self,
        speakers: Option<&[Speaker]>,
        head: Head,
        outside: bool,
        distance: f32,
        equalizer: Equalizer,
        spectrum: bool,
    ) -> windows::core::Result<()> {
        let mut told = self.told.borrow_mut();
        if told.head != Some(head) && head.is_sound() {
            told.head = Some(head);
            let message = serde_json::to_string(&Cab::Head { head }).unwrap_or_default();
            told.messages[1] = Some(message.clone());
            self.view.post_json(&message)?;
        }
        if told.speakers.as_ref().map(Option::as_deref) != Some(speakers) {
            let speakers = speakers.map(<[_]>::to_vec);
            told.speakers = Some(speakers.clone());
            let message = serde_json::to_string(&Cab::Speakers { speakers }).unwrap_or_default();
            told.messages[0] = Some(message.clone());
            self.view.post_json(&message)?;
        }
        let camera = (outside, if outside { (distance * 4.0).round() / 4.0 } else { 0.0 });
        if told.camera != Some(camera) && camera.1.is_finite() {
            told.camera = Some(camera);
            let message = serde_json::to_string(&Cab::Outside { on: camera.0, distance: camera.1 }).unwrap_or_default();
            told.messages[2] = Some(message.clone());
            self.view.post_json(&message)?;
        }
        if told.equalizer != Some(equalizer) {
            told.equalizer = Some(equalizer);
            let message = serde_json::to_string(&Cab::Equalizer { equalizer }).unwrap_or_default();
            told.messages[3] = Some(message.clone());
            self.view.post_json(&message)?;
        }
        if told.spectrum != Some(spectrum) {
            told.spectrum = Some(spectrum);
            let message = serde_json::to_string(&Cab::Spectrum { on: spectrum }).unwrap_or_default();
            told.messages[4] = Some(message.clone());
            self.view.post_json(&message)?;
        }
        Ok(())
    }

    pub fn take_reports(&self) -> Vec<Report> {
        let mut reports = std::mem::take(&mut *self.pending.borrow_mut());
        let progress = self.sign_in.borrow().as_ref().map(SignInWindow::progress);
        if let Some(progress @ (Progress::SignedIn | Progress::Closed)) = progress {
            self.sign_in.borrow_mut().take();
            reports.push(Report::SignInWindow(false));
            if progress == Progress::SignedIn {
                let _ = self.view.navigate(HOME);
                self.confirming.start();
                reports.push(Report::Confirming(true));
            }
        }
        for message in self.view.take_page_messages() {
            if let Some(bars) = crate::speakers::read_spectrum(&message) {
                reports.push(Report::Spectrum(bars));
                continue;
            }
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&message) {
                if value.get("ready").and_then(|v| v.as_bool()) == Some(true) {
                    for told in self.told.borrow().messages.iter().flatten() {
                        let _ = self.view.post_json(told);
                    }
                } else if let Some(playback) = value.get("playback") {
                    if playback.is_null() {
                        reports.push(Report::Playback(None));
                    } else if let Ok(p) = serde_json::from_value::<Playback>(playback.clone()) {
                        reports.push(Report::Playback(Some(Box::new(p))));
                    }
                } else if let Ok(state) = serde_json::from_value::<State>(value) {
                    reports.push(Report::State(state));
                }
            }
        }
        let signed_in = reports.iter().rev().find_map(|r| match r {
            Report::State(s) => Some(s.signed_in),
            _ => None,
        });
        if self.confirming.ended(signed_in) {
            reports.push(Report::Confirming(false));
        }
        reports
    }

    pub fn failed(&self) -> bool {
        self.view.take_failure().is_some()
    }

    pub fn close(self, stage: &Stage) {
        let _ = stage.remove(&self.view);
    }
}

pub fn state_message(state: Option<&State>, signing_in: bool) -> String {
    serde_json::json!({
        "type": "yandexMusic",
        "signedIn": state.map(|s| s.signed_in),
        "playing": state.map(|s| s.playing),
        "signingIn": signing_in,
        "avatar": state.and_then(|s| s.avatar.as_deref()),
    })
    .to_string()
}

pub fn playback_message(playback: Option<&Playback>) -> String {
    serde_json::json!({
        "type": "yandexMusicPlayback",
        "playback": playback,
    })
    .to_string()
}
