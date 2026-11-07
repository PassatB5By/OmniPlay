import { useText } from '../../state/text'
import { playOrPause, skip, useYandexMusic } from './yandexMusic'
import './yandexMusic.css'

export function YandexMusicApp() {
  const text = useText()
  const playback = useYandexMusic((state) => state.playback)
  const signedIn = useYandexMusic((state) => state.signedIn)
  const track = playback?.track

  return (
    <section className="app-panel ya-app" aria-label="Яндекс Музыка">
      <header className="ya-header">
        <div className="ya-logo">
          <svg className="ya-logo-icon" viewBox="0 0 1024 1024">
            <rect width="1024" height="1024" rx="224" fill="#fc3f1d"/>
            <circle cx="512" cy="512" r="300" fill="#ffdb4d"/>
            <polygon points="450,380 650,512 450,644" fill="#fc3f1d"/>
          </svg>
          <span>{text.apps.yandexMusic || 'Яндекс Музыка'}</span>
        </div>
        {signedIn === false && (
          <div className="ya-signin-notice">
            Войдите через Companion
          </div>
        )}
      </header>

      <div className="ya-content">
        <div className="ya-cover-wrap">
          {track?.artwork ? (
            <img className="ya-cover" src={track.artwork} alt="" />
          ) : (
            <div className="ya-cover-placeholder">✦</div>
          )}
        </div>

        <h2 className="ya-track-title">{track?.title || 'Яндекс Музыка'}</h2>
        <div className="ya-track-artist">{track?.artist || 'Готово к воспроизведению'}</div>

        <div className="ya-controls">
          <button
            type="button"
            className="ya-btn"
            aria-label="Previous track"
            onClick={() => skip(-1)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          <button
            type="button"
            className="ya-btn ya-btn-primary"
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
            className="ya-btn"
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
