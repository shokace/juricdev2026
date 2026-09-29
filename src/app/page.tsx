import Image from "next/image";
import PortfolioMotion from "@/components/portfolio-motion";
import NeverlandingTraffic from "@/components/neverlanding-traffic";
import LinkIcon from "@/components/link-icon";

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  const github = href.startsWith("https://github.com/");
  return <a className="text-link" href={href} target="_blank" rel="noreferrer">{github && <LinkIcon name="github" />}{children}{!github && <LinkIcon name="external" />}</a>;
}

export default function Home() {
  return (
    <div className="portfolio">
      <PortfolioMotion />
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <a className="wordmark" href="#main" aria-label="Petar Juric, home">juric.dev</a>
        <nav aria-label="Main navigation">
          <a href="#about">About</a>
          <a href="#work">Projects</a>
          <a className="icon-link" href="https://www.linkedin.com/in/pjuric/" target="_blank" rel="noreferrer"><LinkIcon name="linkedin" />LinkedIn</a>
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        <section id="about" className="hero" aria-labelledby="profile-title">
          <div className="hero-copy">
            <p className="eyebrow">Software engineer</p>
            <h1 id="profile-title">Petar Juric<span aria-hidden="true">.</span></h1>
            <p className="hero-description">Building high-volume data ingestion pipelines across Apple’s engineering teams.</p>
            <p className="hero-context">Previously worked on real-time <a href="https://en.wikipedia.org/wiki/5G" target="_blank" rel="noreferrer">5G</a> and <a href="https://en.wikipedia.org/wiki/6G" target="_blank" rel="noreferrer">6G</a> systems at Ericsson.</p>
            <div className="hero-actions">
              <a className="text-link hero-link" href="#work">View projects <LinkIcon name="down" /></a>
              <ExternalLink href="https://github.com/shokace/">GitHub</ExternalLink>
            </div>
          </div>
          <div className="hero-profile">
            <Image className="profile-portrait" src="/images/petar-juric.png" alt="Petar Juric" width={800} height={800} preload unoptimized />
            <aside className="current-role" aria-label="Current role">
              <p className="eyebrow">Currently</p>
              <p className="company-name">Apple</p>
              <p>Software engineering</p>
              <span className="role-type">Contract</span>
              <p className="role-location">Based in the United States</p>
            </aside>
          </div>
        </section>

        <section id="work" className="work-section" aria-labelledby="work-title">
          <div className="section-heading" data-reveal>
            <h2 id="work-title">Highlighted project</h2>
          </div>

          <article className="featured-project" aria-labelledby="sefaly-title">
            <div className="project-intro" data-reveal>
              <p className="project-category">Prior project <span aria-hidden="true">/</span> Creator</p>
              <h3 id="sefaly-title">Sefaly</h3>
              <p className="project-subtitle">Encrypted cloud storage.</p>
              <div className="project-links">
                <ExternalLink href="https://www.sefaly.com">View product</ExternalLink>
                <ExternalLink href="https://github.com/shokace/sefaly-cli">CLI source</ExternalLink>
              </div>
            </div>
            <div className="project-story" data-reveal>
              <p>I created Sefaly, a cloud storage platform with quantum-safe, end-to-end encryption and a companion command-line client.</p>
              <p>The product brought file management and secure sharing into a web application, with encryption performed on the user’s device before upload. The CLI extended those workflows to the terminal.</p>
              <p className="project-status">Sefaly is part of my previous independent work. I’m no longer actively developing the project.</p>
            </div>
            <div className="project-details" aria-label="Sefaly engineering details" data-reveal>
              <div><span className="detail-number" aria-hidden="true">01</span><div><h4>Encrypt on the device</h4><p>Client-side file encryption with AES-256-GCM.</p></div></div>
              <div><span className="detail-number" aria-hidden="true">02</span><div><h4>Protect the keys</h4><p>ML-KEM key wrapping; encrypted files in storage.</p></div></div>
              <div><span className="detail-number" aria-hidden="true">03</span><div><h4>Work from the terminal</h4><p>Upload, download, organize, and share through the CLI.</p></div></div>
            </div>
          </article>

        </section>

        <section className="projects-section" aria-labelledby="projects-title">
          <div className="section-heading" data-reveal>
            <h2 id="projects-title">Other projects</h2>
          </div>

          <article className="project-row" aria-labelledby="nullspeak-title" data-reveal>
            <div><p className="project-category">Computer vision</p><h3 id="nullspeak-title">Nullspeak</h3></div>
            <div className="project-row-description"><p>A visual speech recognition prototype that generates captions from live camera input, using mouth tracking and streaming inference without audio.</p><p className="project-note">Python, OpenCV, PyTorch, and AutoAVSR.</p></div>
            <ExternalLink href="https://github.com/shokace/nullspeak">View source</ExternalLink>
          </article>

          <article className="project-row" aria-labelledby="fafr-title" data-reveal>
            <div><p className="project-category">Signal processing</p><h3 id="fafr-title">FAFR</h3></div>
            <div className="project-row-description"><p>A C++ audio tool that encodes waveforms as framewise Fourier coefficients, reconstructs audio, and exports explicit equations describing the signal.</p><p className="project-note">C++17, FFTW3, libsndfile, and an FFmpeg decoder patch.</p></div>
            <ExternalLink href="https://github.com/shokace/FAFR">View source</ExternalLink>
          </article>

          <article className="project-row" aria-labelledby="fxb-title" data-reveal>
            <div><p className="project-category">Desktop software</p><h3 id="fxb-title">FXBViewer</h3></div>
            <div className="project-row-description"><p>A C++ and Qt utility that parses Sylenth1 preset banks and searches their contents by name, making large preset collections easier to navigate.</p><p className="project-note"><a href="https://sourceforge.net/projects/fxb-viewer/files/stats/timeline" target="_blank" rel="noreferrer">500+ downloads on SourceForge</a></p></div>
            <ExternalLink href="https://github.com/shokace/fxbViewer---WINDOWS">View source</ExternalLink>
          </article>

          <article className="project-row" aria-labelledby="neverlanding-title" data-reveal>
            <div><p className="project-category">Web application</p><h3 id="neverlanding-title">Neverlanding.page</h3></div>
            <div className="project-row-description"><p>A web discovery application for exploring independent websites, saving favorites, and keeping a personal browsing history.</p><NeverlandingTraffic /></div>
            <ExternalLink href="https://neverlanding.page">View project</ExternalLink>
          </article>

          <article className="project-row" aria-labelledby="starlink-title" data-reveal>
            <div><p className="project-category">Data visualization</p><h3 id="starlink-title">Starlink Tracker</h3></div>
            <div className="project-row-description"><p>An interactive constellation viewer that turns public orbital data into estimated satellite positions on a 3D globe, with search, filtering, and 24-hour forecast playback.</p><p className="project-note">Meteor, React, MongoDB, CesiumJS, and satellite.js.</p></div>
            <ExternalLink href="https://github.com/shokace/StarlinkTracker">View source</ExternalLink>
          </article>
        </section>

      </main>

      <footer className="site-footer">
        <p>Petar Juric <span aria-hidden="true">/</span> Software engineer</p>
        <div><a href="/usage">Usage</a><a className="icon-link" href="#main">Back to top <LinkIcon name="up" /></a></div>
      </footer>
    </div>
  );
}
