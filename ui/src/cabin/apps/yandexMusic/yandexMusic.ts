import { useMemo } from 'react'
import { create } from 'zustand'
import {
  isInHost,
  postToHost,
  type YandexMusicCommand,
  type YandexMusicPlayback,
} from '../../../shared/host'
import type { MediaSource } from '../../../shared/media'

export interface YandexMusicState {
  signedIn: boolean | null
  playing: boolean | null
  signingIn: boolean
  playback: (YandexMusicPlayback & { at: number }) | null
  volume: number
  nowPlaying: boolean
}

export const useYandexMusic = create<YandexMusicState>(() => ({
  signedIn: null,
  playing: null,
  signingIn: false,
  playback: null,
  volume: 1,
  nowPlaying: false,
}))

export function yandexMusic(command: YandexMusicCommand): void {
  if (isInHost()) postToHost({ type: 'yandexMusic', command })
}

export function receiveYandexMusicState(
  signedIn: boolean | null,
  playing: boolean | null,
  signingIn: boolean,
): void {
  useYandexMusic.setState({ signedIn, playing, signingIn })
}

export function receiveYandexMusicPlayback(playback: YandexMusicPlayback | null): void {
  useYandexMusic.setState({
    playback: playback ? { ...playback, at: performance.now() } : null,
    playing: playback ? playback.playing : null,
  })
}

export function positionOf(playback: YandexMusicState['playback'], now: number): number {
  if (!playback) return 0
  const run = playback.playing && !playback.loading ? (now - playback.at) / 1000 : 0
  const end = playback.duration || Number.POSITIVE_INFINITY
  return Math.min(end, playback.position + run)
}

export function playOrPause(): void {
  const { playback } = useYandexMusic.getState()
  if (playback?.playing) {
    yandexMusic({ action: 'pause' })
  } else {
    yandexMusic({ action: 'play' })
  }
}

export function skip(direction: 1 | -1): void {
  if (direction > 0) {
    yandexMusic({ action: 'next' })
  } else {
    yandexMusic({ action: 'previous' })
  }
}

export function seek(seconds: number): void {
  yandexMusic({ action: 'seek', seconds })
}

export function setVolume(share: number, hostOnly = false): void {
  const volume = Math.min(1, Math.max(0, share))
  if (!hostOnly) useYandexMusic.setState({ volume })
  yandexMusic({ action: 'volume', percent: Math.round(volume * 100) })
}

export function sendVolume(share: number): void {
  setVolume(share, true)
}

export function playingNow(): boolean {
  return Boolean(useYandexMusic.getState().playback?.playing)
}

export function pauseNow(): void {
  if (!playingNow()) return
  yandexMusic({ action: 'pause' })
}

export function resumeNow(): void {
  const { playback } = useYandexMusic.getState()
  if (!playback || playback.playing) return
  yandexMusic({ action: 'play' })
}

export function useYandexMusicSource(): { source: MediaSource; artwork: string | null } | null {
  const playback = useYandexMusic((state) => state.playback)
  return useMemo(() => {
    if (!playback || !playback.track) return null
    const track = playback.track
    return {
      source: {
        id: 'westplay-yandex-music',
        service: 'yandexMusic',
        title: track.title || 'Яндекс Музыка',
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
