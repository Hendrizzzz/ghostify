import type { Store } from '../lib/links';

export function StoreButtons({ stores }: { stores: Store[] }) {
  return (
    <div className="stores">
      {stores.map((s, i) => (
        <a
          key={s.key}
          className={`store${i === 0 ? ' is-primary' : ''}`}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={s.logo} alt="" width={22} height={22} />
          Add to {s.name}
        </a>
      ))}
    </div>
  );
}
