import { useMemo } from 'react'
import { create } from 'zustand'
import {
  isInHost,
  postToHost,
  type SoundCloudCommand,
  type SoundCloudPlayback,
} from '../../../shared/host'
import type { MediaSource } from '../../../shared/media'

export interface SoundCloudState {
  signedIn: boolean | null
  playing: boolean | null
  signingIn: boolean
  playback: (SoundCloudPlayback & { at: number }) | null
  volume: number
  nowPlaying: boolean
}

export const useSoundCloud = create<SoundCloudState>(() => ({
  signedIn: null,
  playing: null,
  signingIn: false,
  playback: null,
  volume: 1,
  nowPlaying: false,
}))

export function soundcloud(command: SoundCloudCommand): void {
  if (isInHost()) postToHost({ type: 'soundcloud', command })
}

export function receiveSoundCloudState(
  signedIn: boolean | null,
  playing: boolean | null,
  signingIn: boolean,
): void {
  useSoundCloud.setState({ signedIn, playing, signingIn })
}

export function receiveSoundCloudPlayback(playback: SoundCloudPlayback | null): void {
  useSoundCloud.setState({
    playback: playback ? { ...playback, at: performance.now() } : null,
    playing: playback ? playback.playing : null,
  })
}

export function positionOf(playback: SoundCloudState['playback'], now: number): number {
  if (!playback) return 0
  const run = playback.playing && !playback.loading ? (now - playback.at) / 1000 : 0
  const end = playback.duration || Number.POSITIVE_INFINITY
  return Math.min(end, playback.position + run)
}

export function playOrPause(): void {
  const { playback } = useSoundCloud.getState()
  if (playback?.playing) {
    soundcloud({ action: 'pause' })
  } else {
    soundcloud({ action: 'play' })
  }
}

export function skip(direction: 1 | -1): void {
  if (direction > 0) {
    soundcloud({ action: 'next' })
  } else {
    soundcloud({ action: 'previous' })
  }
}

export function seek(seconds: number): void {
  soundcloud({ action: 'seek', seconds })
}

export function setVolume(share: number, hostOnly = false): void {
  const volume = Math.min(1, Math.max(0, share))
  if (!hostOnly) useSoundCloud.setState({ volume })
  soundcloud({ action: 'volume', percent: Math.round(volume * 100) })
}

export function sendVolume(share: number): void {
  setVolume(share, true)
}

export function playingNow(): boolean {
  return Boolean(useSoundCloud.getState().playback?.playing)
}

export function pauseNow(): void {
  if (!playingNow()) return
  soundcloud({ action: 'pause' })
}

export function resumeNow(): void {
  const { playback } = useSoundCloud.getState()
  if (!playback || playback.playing) return
  soundcloud({ action: 'play' })
}

export function useSoundCloudSource(): { source: MediaSource; artwork: string | null } | null {
  const playback = useSoundCloud((state) => state.playback)
  return useMemo(() => {
    if (!playback || !playback.track) return null
    const track = playback.track
    return {
      source: {
        id: 'westplay-soundcloud',
        service: 'soundcloud',
        title: track.title || 'SoundCloud',
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
