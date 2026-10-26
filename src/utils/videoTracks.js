export function getExternalSubtitleIndex(selectedSubtitle, subOptions) {
  const option = selectedSubtitle >= 0 ? subOptions[selectedSubtitle] : null;
  return option?.kind === 'ext' ? option.index : -1;
}
