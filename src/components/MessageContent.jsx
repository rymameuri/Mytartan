import { stripMarkdownFormatting } from "../utils/stripMarkdown";
import { linkLabelForUrl } from "../utils/spokenText";

const URL_SPLIT = /(https?:\/\/[^\s<>"'()]+)/gi;

function MessageContent({ content }) {
  const plain = stripMarkdownFormatting(content);
  if (!plain) return null;

  const parts = plain.split(URL_SPLIT);
  return (
    <div className="msg-text">
      {parts.map((part, index) => {
        if (!part) return null;
        if (!/^https?:\/\//i.test(part)) {
          return <span key={index}>{part}</span>;
        }

        return (
          <a
            key={index}
            className="msg-link"
            href={part}
            target="_blank"
            rel="noopener noreferrer"
          >
            {linkLabelForUrl(part)}
          </a>
        );
      })}
    </div>
  );
}

export default MessageContent;
