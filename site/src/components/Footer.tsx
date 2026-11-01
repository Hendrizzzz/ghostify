/* The mark as a vector, sharp on any screen. */
import mark from '../assets/mark.svg';
import { GITHUB_URL } from '../lib/links';

/* `credits` sets the footer as the last lines of the landing's end credits. */
export function Footer({ base, credits = false }: { base: string; credits?: boolean }) {
  return (
    <footer className={`foot${credits ? ' is-credits' : ''}`}>
      <a className="wordmark" href={base || '/'}>
        <img src={mark} alt="" width={20} height={20} />
        Ghostify
      </a>
      <nav aria-label="Footer">
        <a href={`${base}/status`}>Status</a>
        <a href={`${GITHUB_URL}/blob/main/PRIVACY.md`} target="_blank" rel="noopener noreferrer">
          Privacy
        </a>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          Source
        </a>
        <a
          href={`${GITHUB_URL}/issues/new?template=help_feedback.yml`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Help
        </a>
      </nav>
      <p>Not affiliated with Meta.</p>
    </footer>
  );
}
