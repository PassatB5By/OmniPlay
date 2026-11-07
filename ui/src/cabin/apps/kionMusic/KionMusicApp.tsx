import { useText } from '../../state/text'
import { playOrPause, skip, useKionMusic } from './kionMusic'
import './kionMusic.css'

export function KionMusicApp() {
  const text = useText()
  const playback = useKionMusic((state) => state.playback)
  const signedIn = useKionMusic((state) => state.signedIn)
  const track = playback?.track

  return (
    <section className="app-panel kion-app" aria-label="Кион Музыка">
      <header className="kion-header">
        <div className="kion-logo">
          <svg className="kion-logo-icon" viewBox="0 0 1024 1024">
            <rect width="1024" height="1024" rx="224" fill="#892fe8"/>
            <path d="M300,240 L400,240 L400,680 L300,680 Z M410,500 L610,240 L720,240 L500,520 L730,760 L620,760 Z" fill="#fff"/>
          </svg>
          <span>{text.apps.kionMusic || 'Кион Музыка'}</span>
        </div>
        {signedIn === false && (
          <div className="kion-signin-notice">
            Войдите через Companion
          </div>
        )}
      </header>

      <div className="kion-content">
        <div className="kion-cover-wrap">
          {track?.artwork ? (
            <img className="kion-cover" src={track.artwork} alt="" />
          ) : (
            <div className="kion-cover-placeholder">♫</div>
          )}
        </div>

        <h2 className="kion-track-title">{track?.title || 'Кион Музыка'}</h2>
        <div className="kion-track-artist">{track?.artist || 'Готово к воспроизведению'}</div>

        <div className="kion-controls">
          <button
            type="button"
            className="kion-btn"
            aria-label="Previous track"
            onClick={() => skip(-1)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          <button
            type="button"
            className="kion-btn kion-btn-primary"
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
            className="kion-btn"
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
