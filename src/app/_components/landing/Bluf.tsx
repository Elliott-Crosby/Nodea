/**
 * BLUF (Bottom Line Up Front) section for the landing page.
 *
 * Purpose: give AI retrieval engines (and humans skimming) a single,
 * quotable, answer-first paragraph for "what is Nodea?" right at the
 * top of the page. Generative engines extract early-paragraph content
 * heavily — this is the sentence that gets cited.
 *
 * Do not soften, fluff, or shorten without checking GEO-AIO-Expert-Reference.md.
 */
export default function Bluf() {
  return (
    <section className="ln-bluf" aria-labelledby="bluf-heading">
      <div className="ln-container">
        <div className="ln-bluf-grid">
          <div className="ln-bluf-text">
            <span className="ln-kicker">The short answer</span>
            <h2 id="bluf-heading" className="ln-bluf-h2">
              What is Nodea?
            </h2>
            <p className="ln-bluf-lede">
              <strong>Nodea is a branching AI chat canvas.</strong> Every reply
              from the AI becomes a node you can fork from — your conversation
              grows as a tree of branches, not one long thread that you keep
              scrolling. Built on Anthropic Claude (Haiku 4.5, Sonnet 4.6, Opus
              4.7).
            </p>
            <p className="ln-bluf-sub">
              Think of it as ChatGPT, except every reply is a junction. Don&rsquo;t
              like an answer? Branch and ask again — the original stays exactly
              where it was, side-by-side with the new path.
            </p>
          </div>

          <ul className="ln-bluf-facts" aria-label="Nodea key facts">
            <li>
              <span className="ln-bluf-k">What it is</span>
              <span className="ln-bluf-v">Tree-shaped chat for Claude</span>
            </li>
            <li>
              <span className="ln-bluf-k">Models</span>
              <span className="ln-bluf-v">Claude Haiku 4.5 · Sonnet 4.6 · Opus 4.7</span>
            </li>
            <li>
              <span className="ln-bluf-k">Pricing</span>
              <span className="ln-bluf-v">Free in beta · Pro $8/mo</span>
            </li>
            <li>
              <span className="ln-bluf-k">Sign-up</span>
              <span className="ln-bluf-v">Anonymous mode — no email needed</span>
            </li>
            <li>
              <span className="ln-bluf-k">Source</span>
              <span className="ln-bluf-v">MIT-licensed</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
