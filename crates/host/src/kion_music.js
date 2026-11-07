// OmniPlay / WestPlay, in KION Music / MTS Music (kion_music.rs).
// Runs hidden under the cabin page. Pipes audio to the truck speakers via cab_sound.js
// and intercepts player metadata and controls.
;(() => {
  if ((!location.hostname.includes('mts.ru') && !location.hostname.includes('kion.ru')) || window.top !== window) return
  const post = (message) => window.chrome?.webview?.postMessage(message)

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

  const mediaSessionHandlers = new Map()
  if (navigator.mediaSession) {
    const origSetActionHandler = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession)
    navigator.mediaSession.setActionHandler = (action, handler) => {
      if (handler) mediaSessionHandlers.set(action, handler)
      else mediaSessionHandlers.delete(action)
      return origSetActionHandler(action, handler)
    }
  }

  const getTrack = () => {
    const meta = navigator.mediaSession?.metadata
    if (meta && (meta.title || meta.artist)) {
      const artwork = meta.artwork && meta.artwork.length > 0 ? meta.artwork[meta.artwork.length - 1].src : null
      return {
        title: meta.title || 'Кион Музыка',
        artist: meta.artist || '',
        album: meta.album || '',
        image: artwork,
      }
    }
    // Fallback to DOM elements on MTS / KION music player
    const titleEl = document.querySelector('[data-testid="track-title"], .track-title, .player-track-name, .track__title')
    const artistEl = document.querySelector('[data-testid="track-artist"], .track-artist, .player-artist-name, .track__artists')
    const imgEl = document.querySelector('[data-testid="track-cover"] img, .player-cover img, .track__cover img')
    const title = titleEl?.textContent?.trim() || ''
    const artist = artistEl?.textContent?.trim() || ''
    const image = imgEl?.src || null
    if (title || artist) {
      return { title: title || 'Кион Музыка', artist, album: '', image }
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
      shuffle: false,
      repeat: 'off',
      volume,
    }
    const json = JSON.stringify(playback)
    if (json === toldPlayback) return
    toldPlayback = json
    post({ playback })
  }

  let toldState = ''
  const tellState = () => {
    // Check sign in via profile elements
    const isSigned = Boolean(
      document.querySelector('[data-testid="user-profile"], .user-avatar, .header-profile, a[href*="/profile"], .user-info')
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
        const btn = document.querySelector('[data-testid="player-play"], .player-play-btn, .btn-play')
        if (btn) btn.click()
        else playingNow()?.play()?.catch(() => {})
      }
      tellPlayback()
    },
    pause: async () => {
      const handler = mediaSessionHandlers.get('pause')
      if (handler) {
        try { handler({ action: 'pause' }) } catch {}
      } else {
        const btn = document.querySelector('[data-testid="player-pause"], .player-pause-btn, .btn-pause')
        if (btn) btn.click()
        else playingNow()?.pause()
      }
      tellPlayback()
    },
    next: async () => {
      const handler = mediaSessionHandlers.get('nexttrack')
      if (handler) {
        try { handler({ action: 'nexttrack' }) } catch {}
      } else {
        const btn = document.querySelector('[data-testid="player-next"], .player-next-btn, .btn-next')
        if (btn) btn.click()
      }
      tellPlayback()
    },
    previous: async () => {
      const handler = mediaSessionHandlers.get('previoustrack')
      if (handler) {
        try { handler({ action: 'previoustrack' }) } catch {}
      } else {
        const btn = document.querySelector('[data-testid="player-prev"], .player-prev-btn, .btn-prev')
        if (btn) btn.click()
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
      document.querySelector('[data-testid="player-shuffle"], .btn-shuffle')?.click()
      tellPlayback()
    },
    repeat: () => {
      document.querySelector('[data-testid="player-repeat"], .btn-repeat')?.click()
      tellPlayback()
    },
  }

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
