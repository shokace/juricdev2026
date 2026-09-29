function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="text-link" href={href} target="_blank" rel="noreferrer">{children}<span aria-hidden="true"> ↗</span></a>;
}

export default function Home() {
  return (
    <div className="portfolio">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <a className="wordmark" href="#main" aria-label="Petar Juric, home">juric.dev</a>
        <nav aria-label="Main navigation">
          <a href="#work">Work</a>
          <a href="#about">About</a>
          <a href="https://www.linkedin.com/in/pjuric/" target="_blank" rel="noreferrer">LinkedIn <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        <section className="hero" aria-labelledby="profile-title">
          <div className="hero-copy">
            <p className="eyebrow">Software engineer</p>
            <h1 id="profile-title">Petar Juric<span aria-hidden="true">.</span></h1>
            <p className="hero-description">Building software across web applications, privacy-focused products, and developer tools.</p>
            <a className="text-link hero-link" href="#work">View selected work <span aria-hidden="true">↓</span></a>
          </div>
          <aside className="current-role" aria-label="Current role">
            <p className="eyebrow">Currently</p>
            <p className="company-name">Apple</p>
            <p>Software engineering</p>
            <span className="role-type">Contract</span>
            <p className="role-location">Based in the United States</p>
          </aside>
        </section>

        <section id="work" className="work-section" aria-labelledby="work-title">
          <div className="section-heading">
            <p className="eyebrow">Selected work</p>
            <h2 id="work-title">From an idea to a working product.</h2>
          </div>

          <article className="featured-project" aria-labelledby="sefaly-title">
            <div className="project-intro">
              <p className="project-category">Past project <span aria-hidden="true">/</span> Creator</p>
              <h3 id="sefaly-title">Sefaly</h3>
              <p className="project-subtitle">Encrypted cloud storage.</p>
              <div className="project-links">
                <ExternalLink href="https://www.sefaly.com">View product</ExternalLink>
                <ExternalLink href="https://github.com/shokace/sefaly-cli">CLI source</ExternalLink>
              </div>
            </div>
            <div className="project-story">
              <p>I created Sefaly, an end-to-end encrypted cloud storage platform, and its companion command-line client.</p>
              <p>The product brought file management and secure sharing into a web application, with encryption performed on the user’s device before upload. The CLI extended those workflows to the terminal.</p>
              <p className="project-status">Sefaly is part of my previous independent work. I’m no longer actively developing the project.</p>
            </div>
            <div className="project-details" aria-label="Sefaly engineering details">
              <div><span className="detail-number" aria-hidden="true">01</span><div><h4>Encrypt on the device</h4><p>Client-side file encryption with AES-256-GCM.</p></div></div>
              <div><span className="detail-number" aria-hidden="true">02</span><div><h4>Protect the keys</h4><p>ML-KEM key wrapping; encrypted files in storage.</p></div></div>
              <div><span className="detail-number" aria-hidden="true">03</span><div><h4>Work from the terminal</h4><p>Upload, download, organize, and share through the CLI.</p></div></div>
            </div>
          </article>

          <article className="project-row" aria-labelledby="neverlanding-title">
            <div><p className="project-category">Web application</p><h3 id="neverlanding-title">Neverlanding.page</h3></div>
            <div className="project-row-description"><p>A web discovery application for exploring independent websites, saving favorites, and keeping a personal browsing history.</p><p className="project-note">Discovery, accounts, and a catalog spanning one million sites.</p></div>
            <ExternalLink href="https://neverlanding.page">View project</ExternalLink>
          </article>

          <article className="project-row" aria-labelledby="fxb-title">
            <div><p className="project-category">Desktop software · 2015–2016</p><h3 id="fxb-title">FXBViewer</h3></div>
            <div className="project-row-description"><p>A C++ and Qt utility that parses Sylenth1 preset banks and searches their contents by name, making large preset collections easier to navigate.</p><p className="project-note"><a href="https://sourceforge.net/projects/fxb-viewer/files/stats/timeline" target="_blank" rel="noreferrer">500+ downloads on SourceForge</a></p></div>
            <ExternalLink href="https://github.com/shokace/fxbViewer---WINDOWS">View source</ExternalLink>
          </article>

          <article className="project-row" aria-labelledby="starlink-title">
            <div><p className="project-category">Data visualization</p><h3 id="starlink-title">Starlink Tracker</h3></div>
            <div className="project-row-description"><p>An interactive constellation viewer that turns public orbital data into estimated satellite positions on a 3D globe, with search, filtering, and 24-hour forecast playback.</p><p className="project-note">Meteor, React, MongoDB, CesiumJS, and satellite.js.</p></div>
            <ExternalLink href="https://github.com/shokace/StarlinkTracker">View source</ExternalLink>
          </article>
        </section>

        <section id="about" className="about-section" aria-labelledby="about-title">
          <div><p className="eyebrow">About</p><h2 id="about-title">Software, end to end.</h2></div>
          <div className="about-text">
            <p>I’m a software engineer based in the United States, currently contracted at Apple.</p>
            <p>My independent work spans desktop utilities, web applications, and data visualization. With Sefaly, I built encrypted storage workflows for both the browser and the command line.</p>
            <div className="about-links">
              <ExternalLink href="https://github.com/shokace/">GitHub</ExternalLink>
              <ExternalLink href="https://www.linkedin.com/in/pjuric/">LinkedIn</ExternalLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>Petar Juric <span aria-hidden="true">/</span> Software engineer</p>
        <div><a href="/usage">Usage</a><a href="#main">Back to top <span aria-hidden="true">↑</span></a></div>
      </footer>
    </div>
  );
}
