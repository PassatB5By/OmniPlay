import { useText } from '../../state/text'
import { playOrPause, skip, useVkMusic } from './vkMusic'
import './vkMusic.css'

export function VkMusicApp() {
  const text = useText()
  const playback = useVkMusic((state) => state.playback)
  const signedIn = useVkMusic((state) => state.signedIn)
  const track = playback?.track

  return (
    <section className="app-panel vk-app" aria-label="ВК Музыка">
      <header className="vk-header">
        <div className="vk-logo">
          <svg className="vk-logo-icon" viewBox="0 0 1024 1024">
            <rect width="1024" height="1024" rx="224" fill="#0077ff"/>
            <path d="M500,320 L600,280 C620,270 640,285 640,308 L640,540 C640,510 590,490 550,510 C500,530 470,580 470,620 C470,660 500,690 550,680 C600,670 640,630 640,580 L640,410 L500,450 Z" fill="#fff"/>
          </svg>
          <span>{text.apps.vkMusic || 'ВК Музыка'}</span>
        </div>
        {signedIn === false && (
          <div className="vk-signin-notice">
            Войдите через Companion
          </div>
        )}
      </header>

      <div className="vk-content">
        <div className="vk-cover-wrap">
          {track?.artwork ? (
            <img className="vk-cover" src={track.artwork} alt="" />
          ) : (
            <div className="vk-cover-placeholder">♬</div>
          )}
        </div>

        <h2 className="vk-track-title">{track?.title || 'ВК Музыка'}</h2>
        <div className="vk-track-artist">{track?.artist || 'Готово к воспроизведению'}</div>

        <div className="vk-controls">
          <button
            type="button"
            className="vk-btn"
            aria-label="Previous track"
            onClick={() => skip(-1)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          <button
            type="button"
            className="vk-btn vk-btn-primary"
            aria-label={playback?.playing ? 'Пауза' : 'Играть'}
            onClick={() => playOrPause()}
          >
            {playback?.playing ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          <button
            type="button"
            className="vk-btn"
            aria-label="Next track"
            onClick={() => skip(1)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
