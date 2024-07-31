import React from 'react';
import { useParams } from 'react-router-dom';
import articleData from './articleData';
import SocialMediaShare from './SocialMediaShare';

const FullArticle = () => {
  const { articleId } = useParams();
  const article = articleData.find(a => a.id === articleId);

  if (!article) {
    return <div>Article not found</div>;
  }

  // Construct the full URL for sharing
  const currentUrl = window.location.href;

  return (
    <div className="full-article">
      <h2>{article.headline}</h2>
      <p className="article-date">{article.date}</p>
      <SocialMediaShare url={currentUrl} title={article.headline} />
      <div dangerouslySetInnerHTML={{ __html: article.content }} />
    </div>
  );
};

export default FullArticle;