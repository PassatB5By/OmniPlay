// OmniPlay / WestPlay, in VK Music (vk_music.rs).
// Runs hidden under the cabin page. Pipes audio to the truck speakers via cab_sound.js
// and intercepts player metadata and controls via VK audio API and MediaSession.
;(() => {
  if ((!location.hostname.includes('vk.com') && !location.hostname.includes('vkmusic.ru')) || window.top !== window) return
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
    // 1. Try getAudioPlayer()
    try {
      if (typeof window.getAudioPlayer === 'function') {
        const player = window.getAudioPlayer()
        const cur = player?.getCurrentAudio?.()
        // VK returns [id, owner_id, url, title, performer, duration, album_id, ...]
        if (Array.isArray(cur) && cur.length >= 5) {
          const title = cur[3] || ''
          const artist = cur[4] || ''
          const cover = cur[14] || null // cover art if present
          if (title || artist) {
            return {
              title: title || 'ВК Музыка',
              artist,
              album: '',
              image: cover,
            }
          }
        }
      }
    } catch {}

    // 2. Try MediaSession
    const meta = navigator.mediaSession?.metadata
    if (meta && (meta.title || meta.artist)) {
      const artwork = meta.artwork && meta.artwork.length > 0 ? meta.artwork[meta.artwork.length - 1].src : null
      return {
        title: meta.title || 'ВК Музыка',
        artist: meta.artist || '',
        album: meta.album || '',
        image: artwork,
      }
    }

    // 3. Fallback to DOM elements on VK audio
    const titleEl = document.querySelector('.top_audio_player_title, .audio_row__title_inner, .AudioPlayerBlock__title')
    const artistEl = document.querySelector('.top_audio_player_artist, .audio_row__performers, .AudioPlayerBlock__performer')
    const imgEl = document.querySelector('.AudioPlayerBlock__cover img, .audio_row__cover')
    const title = titleEl?.textContent?.trim() || ''
    const artist = artistEl?.textContent?.trim() || ''
    const image = imgEl?.src || null
    if (title || artist) {
      return { title: title || 'ВК Музыка', artist, album: '', image }
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
      if (typeof window.getAudioPlayer === 'function') {
        isPlaying = Boolean(window.getAudioPlayer()?.isPlaying?.())
      }
    } catch {}
    if (!isPlaying) {
      isPlaying = el ? !el.paused && !el.ended : navigator.mediaSession?.playbackState === 'playing'
    }

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
    // Check sign in via VK top profile link or account avatar
    const isSigned = Boolean(
      document.querySelector('#top_profile_link, .TopNavBtn__profile, .user_avatar, [data-testid="profile-btn"]')
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
      try {
        if (typeof window.getAudioPlayer === 'function') {
          window.getAudioPlayer()?.play?.()
          tellPlayback()
          return
        }
      } catch {}
      const handler = mediaSessionHandlers.get('play')
      if (handler) {
        try { handler({ action: 'play' }) } catch {}
      } else {
        const btn = document.querySelector('.top_audio_player_play, [data-action="play"]')
        if (btn) btn.click()
        else playingNow()?.play()?.catch(() => {})
      }
      tellPlayback()
    },
    pause: async () => {
      try {
        if (typeof window.getAudioPlayer === 'function') {
          window.getAudioPlayer()?.pause?.()
          tellPlayback()
          return
        }
      } catch {}
      const handler = mediaSessionHandlers.get('pause')
      if (handler) {
        try { handler({ action: 'pause' }) } catch {}
      } else {
        const btn = document.querySelector('.top_audio_player_play.top_audio_player_playing, [data-action="pause"]')
        if (btn) btn.click()
        else playingNow()?.pause()
      }
      tellPlayback()
    },
    next: async () => {
      try {
        if (typeof window.getAudioPlayer === 'function') {
          window.getAudioPlayer()?.nextTrack?.()
          tellPlayback()
          return
        }
      } catch {}
      const handler = mediaSessionHandlers.get('nexttrack')
      if (handler) {
        try { handler({ action: 'nexttrack' }) } catch {}
      } else {
        const btn = document.querySelector('.top_audio_player_next, [data-action="next"]')
        if (btn) btn.click()
      }
      tellPlayback()
    },
    previous: async () => {
      try {
        if (typeof window.getAudioPlayer === 'function') {
          window.getAudioPlayer()?.prevTrack?.()
          tellPlayback()
          return
        }
      } catch {}
      const handler = mediaSessionHandlers.get('previoustrack')
      if (handler) {
        try { handler({ action: 'previoustrack' }) } catch {}
      } else {
        const btn = document.querySelector('.top_audio_player_prev, [data-action="prev"]')
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
          if (typeof window.getAudioPlayer === 'function') {
            window.getAudioPlayer()?.seek?.(seconds)
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
      document.querySelector('.top_audio_player_shuffle')?.click()
      tellPlayback()
    },
    repeat: () => {
      document.querySelector('.top_audio_player_repeat')?.click()
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
