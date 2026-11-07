// OmniPlay / WestPlay, in SoundCloud's web player (soundcloud.rs).
// Runs hidden under the cabin page. Pipes audio to the truck speakers via cab_sound.js
// and intercepts player metadata and controls.
;(() => {
  if (!location.hostname.includes('soundcloud.com') || window.top !== window) return
  const post = (message) => window.chrome?.webview?.postMessage(message)

  // Track known audio elements
  const known = new Set()
  let sounding = null
  const keep = (el) => {
    if (el && !known.has(el)) {
      known.add(el)
      el.addEventListener('playing', () => { sounding = el; tellPlayback() })
      el.addEventListener('pause', tellPlayback)
      el.addEventListener('timeupdate', tellPlayback)
      el.addEventListener('ended', tellPlayback)
      el.addEventListener('volumechange', tellPlayback)
    }
  }

  const playingNow = () =>
    [...known].find((el) => !el.paused && !el.ended && !el.muted) ?? sounding ?? document.querySelector('audio')

  const origPlay = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...args) {
    keep(this)
    sounding = this
    return origPlay.apply(this, args)
  }

  // Hook MediaSession
  const mediaSessionHandlers = new Map()
  if (navigator.mediaSession) {
    const origSetActionHandler = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession)
    navigator.mediaSession.setActionHandler = (action, handler) => {
      if (handler) mediaSessionHandlers.set(action, handler)
      else mediaSessionHandlers.delete(action)
      return origSetActionHandler(action, handler)
    }
  }

  // Intercept track info from MediaSession or DOM
  const getTrack = () => {
    const meta = navigator.mediaSession?.metadata
    if (meta && (meta.title || meta.artist)) {
      const artwork = meta.artwork && meta.artwork.length > 0 ? meta.artwork[meta.artwork.length - 1].src : null
      return {
        title: meta.title || 'SoundCloud',
        artist: meta.artist || '',
        album: meta.album || '',
        image: artwork,
      }
    }
    const titleEl = document.querySelector('.playbackSoundBadge__titleLink, .playbackSoundBadge__title')
    const artistEl = document.querySelector('.playbackSoundBadge__lightLink')
    const avatarEl = document.querySelector('.playbackSoundBadge__avatar .image__full, .playbackSoundBadge__avatar span')
    let image = null
    if (avatarEl) {
      const bg = avatarEl.style?.backgroundImage
      if (bg) {
        const match = /url\(['"]?(.*?)['"]?\)/.exec(bg)
        if (match) image = match[1]
      } else if (avatarEl.src) {
        image = avatarEl.src
      }
    }
    const title = titleEl?.textContent?.trim() || ''
    const artist = artistEl?.textContent?.trim() || ''
    if (title || artist) {
      return { title: title || 'SoundCloud', artist, album: '', image }
    }
    return null
  }

  let toldPlayback = ''
  function tellPlayback() {
    const el = playingNow()
    const track = getTrack()
    if (!el && !track) {
      if (toldPlayback !== 'null') {
        toldPlayback = 'null'
        post({ playback: null })
      }
      return
    }
    const isPlaying = el ? !el.paused && !el.ended : navigator.mediaSession?.playbackState === 'playing'
    const duration = el && Number.isFinite(el.duration) ? el.duration : 0
    const position = el && Number.isFinite(el.currentTime) ? el.currentTime : 0
    const volume = el ? el.volume : 1

    const playback = {
      track: track ? { ...track, duration } : null,
      playing: isPlaying,
      loading: isPlaying && el && el.readyState < 3,
      position,
      duration,
      shuffle: Boolean(document.querySelector('.shuffleControl.m-active')),
      repeat: document.querySelector('.repeatControl.m-one') ? 'one' : document.querySelector('.repeatControl.m-all') ? 'all' : 'off',
      volume,
    }
    const json = JSON.stringify(playback)
    if (json === toldPlayback) return
    toldPlayback = json
    post({ playback })
  }

  // Check state: signedIn and playing
  let toldState = ''
  const tellState = () => {
    const isSigned = Boolean(
      document.querySelector('.header__userNavUsernameButton, .header__profileMenu, .userNav__username, a[href^="/settings/"]')
    )
    const el = playingNow()
    const isPlaying = el ? !el.paused && !el.ended : navigator.mediaSession?.playbackState === 'playing'
    const state = {
      signedIn: isSigned,
      playing: isPlaying,
    }
    const json = JSON.stringify(state)
    if (json === toldState) return
    toldState = json
    post(state)
  }

  const CONTROLS = {
    play: async () => {
      const handler = mediaSessionHandlers.get('play')
      if (handler) {
        try { handler({ action: 'play' }) } catch {}
      } else {
        const playBtn = document.querySelector('.playControl, .playControls__play')
        if (playBtn) playBtn.click()
        else playingNow()?.play()?.catch(() => {})
      }
      tellPlayback()
    },
    pause: async () => {
      const handler = mediaSessionHandlers.get('pause')
      if (handler) {
        try { handler({ action: 'pause' }) } catch {}
      } else {
        const playBtn = document.querySelector('.playControl.playing, .playControls__play.playing')
        if (playBtn) playBtn.click()
        else playingNow()?.pause()
      }
      tellPlayback()
    },
    next: async () => {
      const handler = mediaSessionHandlers.get('nexttrack')
      if (handler) {
        try { handler({ action: 'nexttrack' }) } catch {}
      } else {
        const nextBtn = document.querySelector('.skipControl__next, .playControls__next')
        if (nextBtn) nextBtn.click()
      }
      tellPlayback()
    },
    previous: async () => {
      const handler = mediaSessionHandlers.get('previoustrack')
      if (handler) {
        try { handler({ action: 'previoustrack' }) } catch {}
      } else {
        const prevBtn = document.querySelector('.skipControl__previous, .playControls__prev')
        if (prevBtn) prevBtn.click()
        else {
          const el = playingNow()
          if (el) el.currentTime = 0
        }
      }
      tellPlayback()
    },
    seek: ({ seconds }) => {
      const handler = mediaSessionHandlers.get('seekto')
      if (handler && Number.isFinite(seconds)) {
        try { handler({ action: 'seekto', seekTime: seconds }) } catch {}
      } else {
        const el = playingNow()
        if (el && Number.isFinite(seconds)) el.currentTime = Math.max(0, seconds)
      }
      tellPlayback()
    },
    volume: ({ percent }) => {
      if (Number.isFinite(percent)) {
        const v = Math.min(1, Math.max(0, percent / 100))
        for (const el of known) el.volume = v
      }
      tellPlayback()
    },
    fade: ({ level }) => {
      if (Number.isFinite(level)) {
        const l = Math.min(1, Math.max(0, level))
        for (const el of known) el.volume = l
      }
    },
    shuffle: () => {
      document.querySelector('.shuffleControl')?.click()
      tellPlayback()
    },
    repeat: () => {
      document.querySelector('.repeatControl')?.click()
      tellPlayback()
    },
  }

  // Connect to truck cabin audio
  const cab = window.westplayCabSound?.(() => playingNow() ?? document.querySelector('audio'), post)
  if (cab) {
    setInterval(() => {
      cab.tick()
    }, 250)
  }

  const CAB = {
    speakers: (data) => cab?.speakers(data.speakers),
    head: (data) => cab?.head(data),
    outside: (data) => cab?.outside(data.on, data.distance),
    equalizer: (data) => cab?.equalizer(data),
    spectrum: (data) => cab?.spectrum(data.on),
  }

  window.chrome?.webview?.addEventListener('message', ({ data }) => {
    if (CAB[data?.action]) CAB[data.action](data)
    else CONTROLS[data?.action]?.(data)
  })

  setInterval(() => {
    tellPlayback()
    tellState()
  }, 500)

  post({ ready: true })
})()
