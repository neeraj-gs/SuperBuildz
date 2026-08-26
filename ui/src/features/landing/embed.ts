/**
 * The address somebody pasted, turned into the one that plays.
 *
 * Its own file, and tested, because every one of these hosts has a share URL
 * that is not an embed URL — and putting the share URL in an iframe gets you a
 * page asking the visitor to sign in, on a landing page, where the whole point
 * of the section is that the product works. That failure looks exactly like a
 * broken product and it is one regex away at all times.
 *
 * The only thing it is given is `DEMO.url` in `Demo.tsx`.
 */

export interface Embed {
  /** How to draw it: a host's player, or a file a `<video>` can take directly. */
  kind: 'iframe' | 'video';
  src: string;
  title: string;
}

const TITLE = 'Super Builds walkthrough';

/**
 * `autoplay` is a parameter rather than a default, because the section starts
 * paused unless somebody pressed something — a landing page that starts talking
 * at you is the thing every landing page is asked not to do.
 */
export function embedFor(url: string, autoplay = false): Embed | null {
  const raw = url.trim();
  if (!raw) return null;

  const loom = /loom\.com\/(?:share|embed)\/([A-Za-z0-9]+)/.exec(raw);
  if (loom) {
    return { kind: 'iframe', title: TITLE, src: `https://www.loom.com/embed/${loom[1]}?hide_owner=true&hideEmbedTopBar=true${autoplay ? '&autoplay=1' : ''}` };
  }

  // Drive writes the id two ways, and `/view` is a page, not a player.
  const drive = /drive\.google\.com\/(?:file\/d\/([-\w]{10,})|open\?id=([-\w]{10,}))/.exec(raw);
  if (drive) {
    return { kind: 'iframe', title: TITLE, src: `https://drive.google.com/file/d/${drive[1] ?? drive[2]}/preview` };
  }

  const yt = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([-\w]{6,})/.exec(raw);
  if (yt) {
    return { kind: 'iframe', title: TITLE, src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0${autoplay ? '&autoplay=1' : ''}` };
  }

  if (/\.(?:mp4|webm|mov|m4v)(?:\?|$)/i.test(raw)) return { kind: 'video', title: TITLE, src: raw };

  // Something else — Vimeo, a self-hosted player. An iframe is the best guess,
  // and a wrong guess here is visible rather than silent.
  return { kind: 'iframe', title: TITLE, src: raw };
}
