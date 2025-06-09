// server/src/types.js
export const ContentType = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  HTML: 'HTML'
};

export const isValidContentType = (type) => {
  return Object.values(ContentType).includes(type);
};