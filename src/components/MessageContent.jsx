import { stripMarkdownFormatting } from "../utils/stripMarkdown";

function MessageContent({ content }) {
  return stripMarkdownFormatting(content);
}

export default MessageContent;
