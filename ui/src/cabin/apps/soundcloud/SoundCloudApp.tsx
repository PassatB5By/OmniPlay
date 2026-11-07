import { playOrPause, skip, useSoundCloud } from './soundcloud'
import './soundcloud.css'

export function SoundCloudApp() {
  const playback = useSoundCloud((state) => state.playback)
  const signedIn = useSoundCloud((state) => state.signedIn)
  const track = playback?.track

  return (
    <section className="app-panel sc-app" aria-label="SoundCloud">
      <header className="sc-header">
        <div className="sc-logo">
          <svg className="sc-logo-icon" viewBox="0 0 1024 1024">
            <rect width="1024" height="1024" rx="224" fill="#ff5500"/>
            <path d="M300,600 C300,520 360,460 440,460 C460,460 480,465 500,475 C520,410 580,360 650,360 C740,360 810,430 810,520 C840,530 860,560 860,600 C860,650 820,690 770,690 L300,690 Z" fill="#fff"/>
          </svg>
          <span>SoundCloud</span>
        </div>
        {signedIn === false && (
          <div className="sc-signin-notice">
            Sign in via Companion
          </div>
        )}
      </header>

      <div className="sc-content">
        <div className="sc-cover-wrap">
          {track?.artwork ? (
            <img className="sc-cover" src={track.artwork} alt="" />
          ) : (
            <div className="sc-cover-placeholder">☁</div>
          )}
        </div>

        <h2 className="sc-track-title">{track?.title || 'SoundCloud'}</h2>
        <div className="sc-track-artist">{track?.artist || 'Ready to stream'}</div>

        <div className="sc-controls">
          <button
            type="button"
            className="sc-btn"
            aria-label="Previous track"
            onClick={() => skip(-1)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          <button
            type="button"
            className="sc-btn sc-btn-primary"
            aria-label={playback?.playing ? 'Pause' : 'Play'}
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
            className="sc-btn"
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
