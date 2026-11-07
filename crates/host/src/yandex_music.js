// OmniPlay / WestPlay, in Yandex Music (yandex_music.rs).
// Runs hidden under the cabin page. Pipes audio to the truck speakers via cab_sound.js
// and intercepts player metadata and controls via externalAPI and MediaSession.
;(() => {
  if (!location.hostname.includes('music.yandex.ru') || window.top !== window) return
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
    // 1. Try externalAPI if available
    try {
      const api = window.externalAPI
      if (api?.getCurrentTrack) {
        const cur = api.getCurrentTrack()
        if (cur && cur.title) {
          const artist = cur.artists?.map((a) => a.title)?.join(', ') || ''
          const album = cur.album?.title || ''
          const cover = cur.cover ? `https://${cur.cover.replace('%%', '400x400')}` : null
          return {
            title: cur.title,
            artist,
            album,
            image: cover,
          }
        }
      }
    } catch {}

    // 2. Try MediaSession
    const meta = navigator.mediaSession?.metadata
    if (meta && (meta.title || meta.artist)) {
      const artwork = meta.artwork && meta.artwork.length > 0 ? meta.artwork[meta.artwork.length - 1].src : null
      return {
        title: meta.title || 'Яндекс Музыка',
        artist: meta.artist || '',
        album: meta.album || '',
        image: artwork,
      }
    }

    // 3. Fallback to DOM
    const titleEl = document.querySelector('.track__title, .player-controls .track-name')
    const artistEl = document.querySelector('.track__artists, .player-controls .artist-name')
    const imgEl = document.querySelector('.track-cover img, .player-controls img')
    const title = titleEl?.textContent?.trim() || ''
    const artist = artistEl?.textContent?.trim() || ''
    const image = imgEl?.src || null
    if (title || artist) {
      return { title: title || 'Яндекс Музыка', artist, album: '', image }
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
    let isPlaying = false
    try {
      if (window.externalAPI?.isPlaying) isPlaying = Boolean(window.externalAPI.isPlaying())
    } catch {}
    if (!isPlaying) {
      isPlaying = el ? !el.paused && !el.ended : navigator.mediaSession?.playbackState === 'playing'
    }

    let position = 0
    let duration = 0
    try {
      const prog = window.externalAPI?.getProgress?.()
      if (prog) {
        position = Number(prog.position) || 0
        duration = Number(prog.duration) || 0
      }
    } catch {}
    if (!duration && el && Number.isFinite(el.duration)) duration = el.duration
    if (!position && el && Number.isFinite(el.currentTime)) position = el.currentTime
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
    let isSigned = false
    try {
      const user = window.externalAPI?.getUserInfo?.()
      if (user && (user.uid || user.login)) isSigned = true
    } catch {}
    if (!isSigned) {
      isSigned = Boolean(
        document.querySelector('.user__userpic, .user_avatar, [data-testid="user-avatar"], a[href*="/users/"]')
      )
    }
    let isPlaying = false
    try {
      if (window.externalAPI?.isPlaying) isPlaying = Boolean(window.externalAPI.isPlaying())
    } catch {}
    if (!isPlaying) {
      const el = playingNow()
      isPlaying = el ? !el.paused && !el.ended : navigator.mediaSession?.playbackState === 'playing'
    }
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
      try {
        if (window.externalAPI?.play) {
          window.externalAPI.play()
          tellPlayback()
          return
        }
      } catch {}
      const handler = mediaSessionHandlers.get('play')
      if (handler) {
        try { handler({ action: 'play' }) } catch {}
      } else {
        const btn = document.querySelector('.player-controls__play, [data-testid="player-play"]')
        if (btn) btn.click()
        else playingNow()?.play()?.catch(() => {})
      }
      tellPlayback()
    },
    pause: async () => {
      try {
        if (window.externalAPI?.togglePause) {
          if (window.externalAPI.isPlaying?.()) window.externalAPI.togglePause()
          tellPlayback()
          return
        }
      } catch {}
      const handler = mediaSessionHandlers.get('pause')
      if (handler) {
        try { handler({ action: 'pause' }) } catch {}
      } else {
        const btn = document.querySelector('.player-controls__play.player-controls__play_pause, [data-testid="player-pause"]')
        if (btn) btn.click()
        else playingNow()?.pause()
      }
      tellPlayback()
    },
    next: async () => {
      try {
        if (window.externalAPI?.next) {
          window.externalAPI.next()
          tellPlayback()
          return
        }
      } catch {}
      const handler = mediaSessionHandlers.get('nexttrack')
      if (handler) {
        try { handler({ action: 'nexttrack' }) } catch {}
      } else {
        const btn = document.querySelector('.player-controls__next, [data-testid="player-next"]')
        if (btn) btn.click()
      }
      tellPlayback()
    },
    previous: async () => {
      try {
        if (window.externalAPI?.prev) {
          window.externalAPI.prev()
          tellPlayback()
          return
        }
      } catch {}
      const handler = mediaSessionHandlers.get('previoustrack')
      if (handler) {
        try { handler({ action: 'previoustrack' }) } catch {}
      } else {
        const btn = document.querySelector('.player-controls__prev, [data-testid="player-prev"]')
        if (btn) btn.click()
        else {
          const el = playingNow()
          if (el) el.currentTime = 0
        }
      }
      tellPlayback()
    },
    seek: ({ seconds }) => {
      if (Number.isFinite(seconds)) {
        try {
          if (window.externalAPI?.setPosition) {
            window.externalAPI.setPosition(seconds)
            tellPlayback()
            return
          }
        } catch {}
        const handler = mediaSessionHandlers.get('seekto')
        if (handler) {
          try { handler({ action: 'seekto', seekTime: seconds }) } catch {}
        } else {
          const el = playingNow()
          if (el) el.currentTime = Math.max(0, seconds)
        }
      }
      tellPlayback()
    },
    volume: ({ percent }) => {
      if (Number.isFinite(percent)) {
        const v = Math.min(1, Math.max(0, percent / 100))
        try {
          window.externalAPI?.setVolume?.(v)
        } catch {}
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
      document.querySelector('.player-controls__shuffle')?.click()
      tellPlayback()
    },
    repeat: () => {
      document.querySelector('.player-controls__repeat')?.click()
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

  // Hook externalAPI events if available
  const hookApi = () => {
    try {
      const api = window.externalAPI
      if (api && api.on && api.EVENT_TRACK) {
        api.on(api.EVENT_TRACK, tellPlayback)
        api.on(api.EVENT_STATE, () => { tellPlayback(); tellState() })
        api.on(api.EVENT_PROGRESS, tellPlayback)
      }
    } catch {}
  }
  setTimeout(hookApi, 2000)
  setTimeout(hookApi, 5000)

  setInterval(() => {
    tellPlayback()
    tellState()
  }, 500)

  post({ ready: true })
})()
