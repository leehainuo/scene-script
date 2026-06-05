export type ImportedTextChapter = {
  title: string
  text: string
}

const CHAPTER_HEADING_PATTERN =
  /^(?:(?:第\s*[零一二三四五六七八九十百千万两0-9]+\s*[章节回卷部集篇幕])|(?:卷\s*[零一二三四五六七八九十百千万两0-9]+)|(?:chapter\s*\d+)|(?:chapters?\s*\d+)|(?:prologue|epilogue|序章|楔子|终章|尾声|后记))(?:[\s:：\-—.、].*)?$/i

function normalizeSourceText(source: string) {
  return source.replace(/\r\n?/g, "\n").trim()
}

function isChapterHeading(line: string) {
  return CHAPTER_HEADING_PATTERN.test(line.trim())
}

function splitByDetectedHeadings(source: string): ImportedTextChapter[] {
  const lines = source.split("\n")
  const chapters: ImportedTextChapter[] = []
  const buffer: string[] = []
  let currentTitle = ""
  let detectedHeadingCount = 0

  const pushChapter = () => {
    const text = buffer.join("\n").trim()
    if (!currentTitle && !text) {
      return
    }

    chapters.push({
      title: currentTitle || `第 ${chapters.length + 1} 章`,
      text,
    })
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line && isChapterHeading(line)) {
      detectedHeadingCount += 1
      if (currentTitle || buffer.join("").trim()) {
        pushChapter()
        buffer.length = 0
      }
      currentTitle = line
      continue
    }

    buffer.push(rawLine)
  }

  if (currentTitle || buffer.join("").trim()) {
    pushChapter()
  }

  return detectedHeadingCount > 0
    ? chapters.filter((chapter) => chapter.title || chapter.text)
    : []
}

function chunkParagraphs(paragraphs: string[], targetCount: number): ImportedTextChapter[] {
  const totalChars = paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0)
  const targetChars = Math.max(1, Math.ceil(totalChars / targetCount))
  const chapters: ImportedTextChapter[] = []
  let currentChunk: string[] = []
  let currentChars = 0

  for (const paragraph of paragraphs) {
    currentChunk.push(paragraph)
    currentChars += paragraph.length

    if (currentChars >= targetChars && chapters.length < targetCount - 1) {
      chapters.push({
        title: `第 ${chapters.length + 1} 章`,
        text: currentChunk.join("\n\n").trim(),
      })
      currentChunk = []
      currentChars = 0
    }
  }

  if (currentChunk.length > 0) {
    chapters.push({
      title: `第 ${chapters.length + 1} 章`,
      text: currentChunk.join("\n\n").trim(),
    })
  }

  return chapters.filter((chapter) => chapter.text)
}

function splitByParagraphFallback(source: string): ImportedTextChapter[] {
  const paragraphs = source
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (paragraphs.length >= 2) {
    const totalChars = paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0)
    const targetCount = Math.min(paragraphs.length, Math.max(3, Math.min(6, Math.ceil(totalChars / 3500))))
    return chunkParagraphs(paragraphs, targetCount)
  }

  const sentences = source
    .split(/(?<=[。！？!?])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  if (sentences.length >= 3) {
    const targetCount = Math.max(3, Math.min(4, Math.ceil(source.length / 2800)))
    return chunkParagraphs(sentences, Math.min(sentences.length, targetCount))
  }

  return [
    {
      title: "第 1 章",
      text: source,
    },
  ]
}

export function parseNovelTextToChapters(source: string): ImportedTextChapter[] {
  const normalized = normalizeSourceText(source)
  if (!normalized) {
    return []
  }

  const headingChapters = splitByDetectedHeadings(normalized)
  if (headingChapters.length > 0) {
    return headingChapters
  }

  return splitByParagraphFallback(normalized)
}
