import { useEffect } from 'react'
import { command, useYouTube } from '../apps/youtube/youtube'
import { playOrPause, useSpotifySource } from '../apps/spotify/spotify'
import { playOrPause as playOrPauseAppleMusic, useAppleMusicSource } from '../apps/music/appleMusic'
import { playOrPause as playOrPauseYouTubeMusic, useYouTubeMusicSource } from '../apps/youtubeMusic/youtubeMusic'
import { playOrPause as playOrPausePlayer, usePlayerSource } from '../apps/player/player'
import { playOrPause as playOrPauseSoundCloud, useSoundCloudSource } from '../apps/soundcloud/soundcloud'
import { playOrPause as playOrPauseKionMusic, useKionMusicSource } from '../apps/kionMusic/kionMusic'
import { playOrPause as playOrPauseYandexMusic, useYandexMusicSource } from '../apps/yandexMusic/yandexMusic'
import { playOrPause as playOrPauseVkMusic, useVkMusicSource } from '../apps/vkMusic/vkMusic'
import { type NowPlayingSource, shownSource } from './nowPlaying'

/** What Now Playing last showed playing, kept while the screens showing it come and go (nowPlaying.ts). */
let lastPlayed: NowPlayingSource | null = null

/** What Now Playing shows (`shownSource`): which player, and each player's own state (the screen showing it
 * draws it its own way: the Dashboard's widget, the Equalizer's track). */
export function useNowPlaying() {
  const spotify = useSpotifySource()
  const appleMusic = useAppleMusicSource()
  const youtubeMusic = useYouTubeMusicSource()
  const player = usePlayerSource()
  const soundcloud = useSoundCloudSource()
  const kionMusic = useKionMusicSource()
  const yandexMusic = useYandexMusicSource()
  const vkMusic = useVkMusicSource()
  const video = useYouTube((store) => store.current)
  const videoPlaying = useYouTube((store) => store.state?.state === 1 && store.state.video === store.current?.video)
  const playing = {
    video: video !== null && videoPlaying,
    spotify: spotify?.source.status === 'playing',
    appleMusic: appleMusic?.source.status === 'playing',
    youtubeMusic: youtubeMusic?.source.status === 'playing',
    player: player?.source.status === 'playing',
    soundcloud: soundcloud?.source.status === 'playing',
    kionMusic: kionMusic?.source.status === 'playing',
    yandexMusic: yandexMusic?.source.status === 'playing',
    vkMusic: vkMusic?.source.status === 'playing',
  }
  const has = {
    video: video !== null,
    spotify: Boolean(spotify),
    appleMusic: Boolean(appleMusic),
    youtubeMusic: Boolean(youtubeMusic),
    player: Boolean(player),
    soundcloud: Boolean(soundcloud),
    kionMusic: Boolean(kionMusic),
    yandexMusic: Boolean(yandexMusic),
    vkMusic: Boolean(vkMusic),
  }
  const showing = shownSource(playing, has, lastPlayed)
  const showingPlays = showing !== null && playing[showing]
  useEffect(() => {
    if (showing !== null && showingPlays) lastPlayed = showing
  }, [showing, showingPlays])
  return {
    showing,
    playing,
    spotify,
    appleMusic,
    youtubeMusic,
    player,
    soundcloud,
    kionMusic,
    yandexMusic,
    vkMusic,
    video,
  }
}

/** The track Now Playing shows, as one line of a list draws it (the Equalizer's): its title, who it's by, its
 * cover, whether it plays, and playing or pausing it; `null`: nothing to show. */
export function useNowPlayingTrack(): {
  title: string
  by: string
  artwork: string | null
  playing: boolean
  playPause: (() => void) | null
} | null {
  const {
    showing,
    playing,
    spotify,
    appleMusic,
    youtubeMusic,
    player,
    soundcloud,
    kionMusic,
    yandexMusic,
    vkMusic,
    video,
  } = useNowPlaying()
  const music = (
    player: { source: { title: string; artist: string; controls: { playPause: boolean } }; artwork: string | null },
    playPause: () => void,
    plays: boolean,
  ) => ({
    title: player.source.title,
    by: player.source.artist,
    artwork: player.artwork,
    playing: plays,
    playPause: player.source.controls.playPause ? playPause : null,
  })
  switch (showing) {
    case 'video':
      return video
        ? {
            title: video.title,
            by: video.channel,
            artwork: video.thumbnail,
            playing: playing.video,
            playPause: () => command({ action: playing.video ? 'pause' : 'play' }),
          }
        : null
    case 'spotify':
      return spotify ? music(spotify, playOrPause, playing.spotify) : null
    case 'appleMusic':
      return appleMusic ? music(appleMusic, playOrPauseAppleMusic, playing.appleMusic) : null
    case 'youtubeMusic':
      return youtubeMusic ? music(youtubeMusic, playOrPauseYouTubeMusic, playing.youtubeMusic) : null
    case 'player':
      return player ? music(player, playOrPausePlayer, playing.player) : null
    case 'soundcloud':
      return soundcloud ? music(soundcloud, playOrPauseSoundCloud, playing.soundcloud) : null
    case 'kionMusic':
      return kionMusic ? music(kionMusic, playOrPauseKionMusic, playing.kionMusic) : null
    case 'yandexMusic':
      return yandexMusic ? music(yandexMusic, playOrPauseYandexMusic, playing.yandexMusic) : null
    case 'vkMusic':
      return vkMusic ? music(vkMusic, playOrPauseVkMusic, playing.vkMusic) : null
    default:
      return null
  }
}
