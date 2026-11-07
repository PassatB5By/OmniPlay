import { useMemo } from 'react'
import { create } from 'zustand'
import {
  isInHost,
  postToHost,
  type KionMusicCommand,
  type KionMusicPlayback,
} from '../../../shared/host'
import type { MediaSource } from '../../../shared/media'

export interface KionMusicState {
  signedIn: boolean | null
  playing: boolean | null
  signingIn: boolean
  playback: (KionMusicPlayback & { at: number }) | null
  volume: number
  nowPlaying: boolean
}

export const useKionMusic = create<KionMusicState>(() => ({
  signedIn: null,
  playing: null,
  signingIn: false,
  playback: null,
  volume: 1,
  nowPlaying: false,
}))

export function kionMusic(command: KionMusicCommand): void {
  if (isInHost()) postToHost({ type: 'kionMusic', command })
}

export function receiveKionMusicState(
  signedIn: boolean | null,
  playing: boolean | null,
  signingIn: boolean,
): void {
  useKionMusic.setState({ signedIn, playing, signingIn })
}

export function receiveKionMusicPlayback(playback: KionMusicPlayback | null): void {
  useKionMusic.setState({
    playback: playback ? { ...playback, at: performance.now() } : null,
    playing: playback ? playback.playing : null,
  })
}

export function positionOf(playback: KionMusicState['playback'], now: number): number {
  if (!playback) return 0
  const run = playback.playing && !playback.loading ? (now - playback.at) / 1000 : 0
  const end = playback.duration || Number.POSITIVE_INFINITY
  return Math.min(end, playback.position + run)
}

export function playOrPause(): void {
  const { playback } = useKionMusic.getState()
  if (playback?.playing) {
    kionMusic({ action: 'pause' })
  } else {
    kionMusic({ action: 'play' })
  }
}

export function skip(direction: 1 | -1): void {
  if (direction > 0) {
    kionMusic({ action: 'next' })
  } else {
    kionMusic({ action: 'previous' })
  }
}

export function seek(seconds: number): void {
  kionMusic({ action: 'seek', seconds })
}

export function setVolume(share: number, hostOnly = false): void {
  const volume = Math.min(1, Math.max(0, share))
  if (!hostOnly) useKionMusic.setState({ volume })
  kionMusic({ action: 'volume', percent: Math.round(volume * 100) })
}

export function sendVolume(share: number): void {
  setVolume(share, true)
}

export function playingNow(): boolean {
  return Boolean(useKionMusic.getState().playback?.playing)
}

export function pauseNow(): void {
  if (!playingNow()) return
  kionMusic({ action: 'pause' })
}

export function resumeNow(): void {
  const { playback } = useKionMusic.getState()
  if (!playback || playback.playing) return
  kionMusic({ action: 'play' })
}

export function useKionMusicSource(): { source: MediaSource; artwork: string | null } | null {
  const playback = useKionMusic((state) => state.playback)
  return useMemo(() => {
    if (!playback || !playback.track) return null
    const track = playback.track
    return {
      source: {
        id: 'westplay-kion-music',
        service: 'kionMusic',
        title: track.title || 'Кион Музыка',
        artist: track.artist || '',
        album: track.album || '',
        artwork: track.artwork,
        status: playback.playing ? 'playing' : 'paused',
        positionMs: playback.position * 1000,
        positionAt: Math.round(performance.timeOrigin + playback.at),
        durationMs: (playback.duration || track.duration || 0) * 1000,
        controls: { playPause: true, next: true, previous: true, shuffle: true, repeat: true },
        shuffle: playback.shuffle ?? null,
        repeat: playback.repeat === 'one' ? 'track' : playback.repeat === 'all' ? 'list' : 'off',
      },
      artwork: track.artwork,
    }
  }, [playback])
}
