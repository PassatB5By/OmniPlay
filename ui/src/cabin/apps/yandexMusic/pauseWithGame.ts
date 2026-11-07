import { type MusicPlayer, pauseMusicWithGame } from '../musicWithGame'
import {
  pauseNow,
  playingNow,
  resumeNow,
  sendVolume,
  setVolume,
  skip,
  useYandexMusic,
} from './yandexMusic'

export const yandexMusicPlayer: MusicPlayer = {
  name: 'yandex music',
  playingHere: playingNow,
  pauseHere: pauseNow,
  resumeHere: resumeNow,
  volume: () => useYandexMusic.getState().volume,
  sendVolume,
  setVolume,
  skip,
  subscribe: (changed) =>
    useYandexMusic.subscribe((state, before) => {
      const sounding = (playback: typeof state.playback) => Boolean(playback?.playing && !playback.loading)
      changed(sounding(state.playback) && !sounding(before.playback))
    }),
}

export function pauseYandexMusicWithGame(): () => void {
  return pauseMusicWithGame(yandexMusicPlayer)
}
