import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import articleData from './articleData';
import SocialMediaShare from './SocialMediaShare';

const FullArticle = () => {
  const { articleId } = useParams();
  const article = articleData.find(a => a.id === articleId);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!article) {
    return <div>Article not found</div>;
  }

  const currentUrl = window.location.href;

  return (
    <>
      <Helmet>
        <title>{article.headline}</title>
        <meta property="og:title" content={article.headline} />
        <meta property="og:description" content={article.ogDescription || article.summary} />
        <meta property="og:image" content={article.ogImage} />
        <meta property="og:url" content={currentUrl} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={article.ogImage} />
      </Helmet>
      <div className="full-article">
        <h2>{article.headline}</h2>
        <p className="article-date">{article.date}</p>
        <p className="article-by">{article.by}</p>
        <SocialMediaShare url={currentUrl} title={article.headline} />
        <div dangerouslySetInnerHTML={{ __html: article.content }} />
      </div>
    </>
  );
};

export default FullArticle;