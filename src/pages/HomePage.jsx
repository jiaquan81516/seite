import { Brand } from '../components/Brand';
import { ProductPreview } from '../components/ProductPreview';
const STEPS = [
  {
    number: '01',
    title: 'Link your inbox.',
    text: 'Connect Gmail so your AI companion can read bank alerts and payment receipts.',
  },
  {
    number: '02',
    title: 'Let Seite find the details.',
    text: 'The merchant, amount and category, picked out for you. Have a screenshot? Send it to the bot.',
  },
  {
    number: '03',
    title: 'Get on with your day.',
    text: 'Open your tracker to see where it all went.',
  },
];
export default function HomePage({ navigate }) {
  return (
    <main className="landing-shell">
      <header className="landing-header">
        <Brand onClick={() => navigate('home')} />
        <nav aria-label="Welcome navigation">
          <a className="landing-how-link" href="#how-it-works">
            How it works
          </a>
          <button className="plain-link" onClick={() => navigate('signin')}>
            Sign in
          </button>
          <button className="outline" onClick={() => navigate('signup')}>
            Get started <span aria-hidden="true">↗</span>
          </button>
        </nav>
      </header>
      <section className="landing-hero" aria-labelledby="welcome-title">
        <div className="landing-copy">
          <h1 id="welcome-title">
            Track your spending <br />
            without the <em>typing.</em>
          </h1>
          <p>
            Let your AI companion turn payment emails and receipts into a clear picture of
            your spending.
          </p>
          <div className="hero-actions">
            <button className="primary welcome-cta" onClick={() => navigate('signup')}>
              Get started <span aria-hidden="true">↗</span>
            </button>
            <button className="plain-link" onClick={() => navigate('tracker')}>
              Explore the tracker <span aria-hidden="true">→</span>
            </button>
          </div>
          <span className="hero-reassurance">No account needed to explore.</span>
        </div>
        <ProductPreview />
      </section>
      <section className="how-section" id="how-it-works" aria-labelledby="how-title">
        <div className="how-intro">
          <h2 id="how-title">
            How <em>Seite works.</em>
          </h2>
          <p>
            The idea is simple. Your spending is already in your inbox. Give it a place to
            come together.
          </p>
        </div>
        <div className="how-steps">
          {STEPS.map((step) => (
            <article key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-bottom">
        <p>
          <span className="preview-label">Preview</span> You can use the manual tracker
          today, or set up AI chat to review receipts. Email linking is next.
        </p>
        <button className="primary" onClick={() => navigate('signup')}>
          Get started <span aria-hidden="true">↗</span>
        </button>
      </section>
      <footer className="landing-footer">
        <span>seite.</span>
      </footer>
    </main>
  );
}
