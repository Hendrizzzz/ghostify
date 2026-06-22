import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus } from 'lucide-react';

const FAQS = [
  {
    q: 'Does Ghostify read my messages?',
    a: "Ghostify transiently inspects supported request URLs, request payloads, and page or worker messages locally in your browser to identify read receipts, typing indicators, and story-view signals. It does not send your conversations to Ghostify, store raw messages, or ask for login credentials.",
  },
  {
    q: 'Does it work on mobile apps?',
    a: "No. Ghostify is a browser extension and only runs on the web versions — messenger.com, facebook.com, and instagram.com. It has no access to native iOS or Android apps.",
  },
  {
    q: 'Which sites does it work on?',
    a: 'Ghostify activates on the supported web versions of Messenger, Facebook, Instagram, and the Facebook/Messenger proxy frames those apps use. It does nothing on unrelated sites.',
  },
  {
    q: 'Can I turn it off per site?',
    a: 'Yes. The popup shows separate controls per platform. You can enable or disable each signal type independently — hide typing on Instagram while leaving it visible on Messenger, for example.',
  },
  {
    q: 'Can platforms break Ghostify\'s controls?',
    a: "Yes. Meta updates their interfaces regularly and sometimes changes how presence signals are sent. When a platform update breaks a control, we investigate and push a fix, but there is no guarantee of instant coverage. Check the Status page for current public verification and the GitHub repo for known issues.",
  },
  {
    q: 'Does it store my activity?',
    a: 'No. Ghostify has no tracking server, no analytics, and no Ghostify cloud sync. Toggle settings and bundled config stay in your browser, and setting changes are broadcast only to open supported tabs.',
  },
  {
    q: 'Is this ethical?',
    a: "Ghostify is for reducing ambient pressure and accidental signaling — not impersonation, abuse, or manipulation. It gives you the same kind of control you'd have if you turned your phone face-down before reading a message. Use it where quiet drafting and personal privacy are appropriate.",
  },
  {
    q: 'What should I do after updating?',
    a: 'Reload any open messenger.com, facebook.com, or instagram.com tabs after installing or updating. Facebook/Messenger proxy frames are handled inside those web apps.',
  },
];

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section
      style={{
        padding: 'clamp(56px, 8vw, 100px) clamp(28px, 4vw, 56px)',
        maxWidth: 1280,
        margin: '0 auto',
        background: 'var(--g-bg)',
      }}
    >
      <div className="faq-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'clamp(40px, 6vw, 80px)', alignItems: 'start' }}>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.65, margin: '0px 0px -18% 0px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 style={{ fontFamily: 'var(--g-sans)', fontSize: 22, fontWeight: 500, color: 'var(--g-white)', margin: '0 0 16px', lineHeight: 1.2, letterSpacing: 0 }}>
            Before you install.
          </h2>
          <p style={{ fontFamily: 'var(--g-sans)', fontSize: 15, lineHeight: 1.6, color: 'var(--g-body)', margin: 0 }}>
            If something's missing,{' '}
            <a href="https://github.com/Hendrizzzz/Ghostify/issues/new?template=help_feedback.yml" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--g-body)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              open an issue
            </a>
            .
          </p>
        </motion.div>

        <div>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ borderBottom: '1px solid rgba(240,230,210,0.07)' }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}
              >
                <span style={{ fontFamily: 'var(--g-sans)', fontSize: 15, fontWeight: open === i ? 500 : 400, color: open === i ? 'var(--g-white)' : 'var(--g-white-dim)', transition: 'color 0.18s ease', lineHeight: 1.35 }}>
                  {faq.q}
                </span>
                <div style={{ flexShrink: 0 }}>
                  {open === i
                    ? <Minus size={15} color="var(--g-accent)" strokeWidth={1.5} />
                    : <Plus size={15} color="var(--g-dim)" strokeWidth={1.5} />
                  }
                </div>
              </button>

              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p style={{ fontFamily: 'var(--g-sans)', fontSize: 15, lineHeight: 1.7, color: 'var(--g-body)', margin: '0 0 20px', paddingRight: 32, maxWidth: 580 }}>
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

      </div>

      <style>{`
        @media (max-width: 840px) {
          .faq-layout { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
        @media (max-width: 480px) {
          .faq-layout button { padding: 16px 0 !important; }
          .faq-layout button span { font-size: 15px !important; }
        }
      `}</style>
    </section>
  );
}
