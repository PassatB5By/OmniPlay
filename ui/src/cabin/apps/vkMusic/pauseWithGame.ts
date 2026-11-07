import { type MusicPlayer, pauseMusicWithGame } from '../musicWithGame'
import {
  pauseNow,
  playingNow,
  resumeNow,
  sendVolume,
  setVolume,
  skip,
  useVkMusic,
} from './vkMusic'

export const vkMusicPlayer: MusicPlayer = {
  name: 'vk music',
  playingHere: playingNow,
  pauseHere: pauseNow,
  resumeHere: resumeNow,
  volume: () => useVkMusic.getState().volume,
  sendVolume,
  setVolume,
  skip,
  subscribe: (changed) =>
    useVkMusic.subscribe((state, before) => {
      const sounding = (playback: typeof state.playback) => Boolean(playback?.playing && !playback.loading)
      changed(sounding(state.playback) && !sounding(before.playback))
    }),
}

export function pauseVkMusicWithGame(): () => void {
  return pauseMusicWithGame(vkMusicPlayer)
}
