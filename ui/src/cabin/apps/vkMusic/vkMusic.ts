import { useMemo } from 'react'
import { create } from 'zustand'
import {
  isInHost,
  postToHost,
  type VkMusicCommand,
  type VkMusicPlayback,
} from '../../../shared/host'
import type { MediaSource } from '../../../shared/media'

export interface VkMusicState {
  signedIn: boolean | null
  playing: boolean | null
  signingIn: boolean
  playback: (VkMusicPlayback & { at: number }) | null
  volume: number
  nowPlaying: boolean
}

export const useVkMusic = create<VkMusicState>(() => ({
  signedIn: null,
  playing: null,
  signingIn: false,
  playback: null,
  volume: 1,
  nowPlaying: false,
}))

export function vkMusic(command: VkMusicCommand): void {
  if (isInHost()) postToHost({ type: 'vkMusic', command })
}

export function receiveVkMusicState(
  signedIn: boolean | null,
  playing: boolean | null,
  signingIn: boolean,
): void {
  useVkMusic.setState({ signedIn, playing, signingIn })
}

export function receiveVkMusicPlayback(playback: VkMusicPlayback | null): void {
  useVkMusic.setState({
    playback: playback ? { ...playback, at: performance.now() } : null,
    playing: playback ? playback.playing : null,
  })
}

export function positionOf(playback: VkMusicState['playback'], now: number): number {
  if (!playback) return 0
  const run = playback.playing && !playback.loading ? (now - playback.at) / 1000 : 0
  const end = playback.duration || Number.POSITIVE_INFINITY
  return Math.min(end, playback.position + run)
}

export function playOrPause(): void {
  const { playback } = useVkMusic.getState()
  if (playback?.playing) {
    vkMusic({ action: 'pause' })
  } else {
    vkMusic({ action: 'play' })
  }
}

export function skip(direction: 1 | -1): void {
  if (direction > 0) {
    vkMusic({ action: 'next' })
  } else {
    vkMusic({ action: 'previous' })
  }
}

export function seek(seconds: number): void {
  vkMusic({ action: 'seek', seconds })
}

export function setVolume(share: number, hostOnly = false): void {
  const volume = Math.min(1, Math.max(0, share))
  if (!hostOnly) useVkMusic.setState({ volume })
  vkMusic({ action: 'volume', percent: Math.round(volume * 100) })
}

export function sendVolume(share: number): void {
  setVolume(share, true)
}

export function playingNow(): boolean {
  return Boolean(useVkMusic.getState().playback?.playing)
}

export function pauseNow(): void {
  if (!playingNow()) return
  vkMusic({ action: 'pause' })
}

export function resumeNow(): void {
  const { playback } = useVkMusic.getState()
  if (!playback || playback.playing) return
  vkMusic({ action: 'play' })
}

export function useVkMusicSource(): { source: MediaSource; artwork: string | null } | null {
  const playback = useVkMusic((state) => state.playback)
  return useMemo(() => {
    if (!playback || !playback.track) return null
    const track = playback.track
    return {
      source: {
        id: 'westplay-vk-music',
        service: 'vkMusic',
        title: track.title || 'ВК Музыка',
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
