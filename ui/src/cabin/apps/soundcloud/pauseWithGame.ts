import { type MusicPlayer, pauseMusicWithGame } from '../musicWithGame'
import {
  pauseNow,
  playingNow,
  resumeNow,
  sendVolume,
  setVolume,
  skip,
  useSoundCloud,
} from './soundcloud'

export const soundcloudPlayer: MusicPlayer = {
  name: 'soundcloud',
  playingHere: playingNow,
  pauseHere: pauseNow,
  resumeHere: resumeNow,
  volume: () => useSoundCloud.getState().volume,
  sendVolume,
  setVolume,
  skip,
  subscribe: (changed) =>
    useSoundCloud.subscribe((state, before) => {
      const sounding = (playback: typeof state.playback) => Boolean(playback?.playing && !playback.loading)
      changed(sounding(state.playback) && !sounding(before.playback))
    }),
}

export function pauseSoundCloudWithGame(): () => void {
  return pauseMusicWithGame(soundcloudPlayer)
}
