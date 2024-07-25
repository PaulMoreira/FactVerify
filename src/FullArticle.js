import React from 'react';
import { useParams } from 'react-router-dom';
import { articles } from './articleData';
import SocialMediaShare from './SocialMediaShare';

const FullArticle = () => {
  const { articleId } = useParams();
  const article = articles.find(a => a.id === articleId);

  if (!article) {
    return <div>Article not found</div>;
  }

  return (
    <div className="full-article">
      <h2>{article.headline}</h2>
      <p className="article-date">{article.date}</p>
      <div dangerouslySetInnerHTML={{ __html: article.content }} />
      <SocialMediaShare url={article.shareUrl} title={article.headline} />
    </div>
  );
};

export default FullArticle;