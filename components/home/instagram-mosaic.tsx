import Image from 'next/image'
import { profileUrl } from '@/lib/instagram/feed'
import { getInstagramFeed } from '@/lib/instagram/server-feed'
import './instagram-mosaic.css'

const archive = [
  ['v-sprinter', 'Mercedes Sprinter'],
  ['v-nugget', 'Ford Transit Custom Nugget'],
  ['v-giottiline', 'Giottiline'],
  ['v-autocaravana', 'Autocaravana perfilada'],
  ['v-salon', 'Salón de autocaravana'],
]

export async function InstagramMosaic() {
  const posts = await getInstagramFeed()
  return (
    <section className="ig-mosaic" aria-labelledby="home-instagram">
      <div className="spread">
        <div className="ig-heading">
          <div>
            <p className="micro">En la nave</p>
            <h2 id="home-instagram">
              {posts ? 'Lo último de @campersnova' : 'Así enseñamos las que vendemos.'}
            </h2>
          </div>
          <a className="quietlink" href={profileUrl} target="_blank" rel="noopener noreferrer">
            Ver Instagram ↗
          </a>
        </div>
        {posts === null ? (
          <div className="ig-grid">
            {archive.map(([file, title]) => (
              <article className="ig-card" key={file}>
                <video
                  controls
                  playsInline
                  preload="none"
                  poster={'/cn-landing/media/' + file + '.jpg'}
                  aria-label={'Vídeo de archivo: ' + title}
                >
                  <source src={'/cn-landing/media/' + file + '.mp4'} type="video/mp4" />
                </video>
                <div className="ig-label">
                  <span>Archivo CampersNova</span>
                  <h3>{title}</h3>
                </div>
              </article>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p>Las próximas publicaciones de @campersnova aparecerán aquí.</p>
        ) : (
          <div className="ig-grid">
            {posts.map((post) => (
              <a
                className="ig-card ig-post"
                key={post.id}
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={
                  'Abrir ' + post.type + ' en Instagram: ' + (post.caption || '@campersnova')
                }
              >
                {post.cover && (
                  <Image
                    unoptimized
                    src={post.cover}
                    alt=""
                    width={800}
                    height={800}
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="ig-label">
                  <span>
                    {post.type} ·{' '}
                    <time dateTime={post.timestamp}>
                      {new Date(post.timestamp).toLocaleDateString('es-ES', {
                        timeZone: 'Europe/Madrid',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </time>
                  </span>
                  <h3>{post.caption || 'Ver en Instagram ↗'}</h3>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
