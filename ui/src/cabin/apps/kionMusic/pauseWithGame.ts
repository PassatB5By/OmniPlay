import { type MusicPlayer, pauseMusicWithGame } from '../musicWithGame'
import {
  pauseNow,
  playingNow,
  resumeNow,
  sendVolume,
  setVolume,
  skip,
  useKionMusic,
} from './kionMusic'

export const kionMusicPlayer: MusicPlayer = {
  name: 'kion music',
  playingHere: playingNow,
  pauseHere: pauseNow,
  resumeHere: resumeNow,
  volume: () => useKionMusic.getState().volume,
  sendVolume,
  setVolume,
  skip,
  subscribe: (changed) =>
    useKionMusic.subscribe((state, before) => {
      const sounding = (playback: typeof state.playback) => Boolean(playback?.playing && !playback.loading)
      changed(sounding(state.playback) && !sounding(before.playback))
    }),
}

export function pauseKionMusicWithGame(): () => void {
  return pauseMusicWithGame(kionMusicPlayer)
}
