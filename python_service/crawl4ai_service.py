import asyncio
import json
import logging
import re
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="FactVerify Search Service")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchRequest(BaseModel):
    query: str
    max_results: int = 5

class SearchResult(BaseModel):
    title: str
    url: str
    content: str

class SearchResponse(BaseModel):
    results: List[SearchResult]
    search_engine: str = "Crawl4AI"
    error: Optional[str] = None

async def crawl_and_process(url: str, crawler: AsyncWebCrawler, max_results: int) -> List[SearchResult]:
    """Crawls a single URL and processes the results with robust regex parsing.
    
    This function extracts direct links to source websites, not intermediate search result pages.
    """
    """Crawls a single URL and processes the results with robust regex parsing."""
    local_results = []
    try:
        logger.info(f"Crawling: {url}")
        config = CrawlerRunConfig(
            word_count_threshold=10, 
            verbose=True
            # Using only supported parameters for your Crawl4AI version
        )
        result = await crawler.arun(url=url, config=config)

        if result and result.success:
            # Extract markdown content based on the type
            markdown_content = ""
            if isinstance(result.markdown, str):
                markdown_content = result.markdown
                logger.info(f"Raw markdown from {url} (string type)")
            else:
                # Use the proper MarkdownGenerationResult structure
                try:
                    # First try to get references_markdown which often contains direct source links
                    if hasattr(result.markdown, 'references_markdown') and result.markdown.references_markdown:
                        markdown_content = result.markdown.references_markdown
                        logger.info(f"Using references_markdown from {url} (contains direct source links)")
                    else:
                        markdown_content = result.markdown.raw_markdown
                        logger.info(f"Using raw_markdown from {url} (MarkdownGenerationResult type)")
                except AttributeError:
                    logger.warning(f"Could not extract markdown from {url}, unexpected result structure")
                    return local_results
            
            logger.info(f"Processing markdown content from {url}")
            
            # Enhanced regex patterns to find search result blocks with title, URL, and snippet
            patterns = [
                # Standard format with ## heading
                re.compile(r'## \[(.*?)\]\((.*?)\)\n(.*?)(?=\n## |$)', re.DOTALL),
                
                # Alternative format with ![]() image prefix
                re.compile(r'!\[\]\(.*?\)\n\[(.*?)\]\((.*?)\)\n(.*?)(?=!\[\]|$)', re.DOTALL),
                
                # Format with title outside of link
                re.compile(r'\[(.*?)\]\n!\[\]\(.*?\)\n(.*?)\n\[(.*?)\]\((.*?)\)', re.DOTALL),
                
                # News article format with heading and link
                re.compile(r'### \[(.*?)\]\((.*?)\)\n(.*?)(?=\n### |$)', re.DOTALL),
                
                # Simple markdown link format
                re.compile(r'\[(.*?)\]\((.*?)\)[^\(]*?([^\[]*)(?=\[|$)', re.DOTALL),
                
                # HTML converted format (common in news sites)
                re.compile(r'<h[1-3]>(.*?)</h[1-3]>.*?<a href="(.*?)".*?>.*?</a>(.*?)(?=<h[1-3]>|$)', re.DOTALL),
                
                # References format (numbered references)
                re.compile(r'\[(\d+)\]\s*(.+?)\s*\((.+?)\)', re.DOTALL),
                
                # Direct URL with title format (common in references)
                re.compile(r'\d+\.\s*(.+?)\s*-\s*(.+?)\s*\((.+?)\)', re.DOTALL)
            ]
            
            # Try each pattern and collect all matches
            all_matches = []
            for pattern in patterns:
                matches = pattern.findall(markdown_content)
                if matches:
                    logger.info(f"Found {len(matches)} matches with pattern {pattern.pattern}")
                    all_matches.extend(matches)
                    
            # Process the matches based on their format
            matches = []
            for match in all_matches:
                if len(match) == 3:  # Standard format: title, url, content
                    matches.append(match)
                elif len(match) == 4:  # Format with title outside link: title, content, _, url
                    matches.append((match[0], match[3], match[1] + "\n" + match[2]))
                    
            # Log all matches for debugging
            logger.info(f"Found {len(matches)} potential matches")
            for i, match in enumerate(matches):
                if len(match) >= 2:
                    logger.info(f"Match {i+1}: Title: {match[0][:50]}... URL: {match[1]}")  
                    
            logger.info(f"Total matches found: {len(matches)}")

            # Log the raw markdown content for debugging
            logger.debug(f"Raw markdown content: {markdown_content[:500]}...")
            
            # If no matches found with regex, try to extract links directly
            if not matches and result.links:
                logger.info(f"No regex matches, trying to extract from result.links")
                try:
                    # Extract links from the result.links field
                    for link_type, links in result.links.items():
                        for link in links:
                            if len(local_results) >= max_results:
                                break
                                
                            if 'url' in link and 'text' in link:
                                url_found = link['url']
                                title = link['text'] or "Link from search results"
                                content = link.get('context', "")
                                
                                # Add to matches for further processing
                                matches.append((title, url_found, content))
                except Exception as e:
                    logger.error(f"Error extracting links from result.links: {str(e)}")

            for match in matches:
                if len(local_results) >= max_results:
                    break

                title = match[0].strip()
                url_found = match[1].strip()
                content = match[2].strip()

                # Skip empty or very short titles/URLs
                if len(title) < 3 or len(url_found) < 10:
                    continue
                    
                # Filter out search engine URLs, navigation links, and other non-content pages
                # More comprehensive detection of non-source URLs
                non_source_patterns = [
                    # Search engines
                    'msn.com/en-us/news/search',
                    'news.google.com/search',
                    'bing.com/search',
                    'google.com/search',
                    'search.yahoo.com',
                    'search?q=',
                    '/search?',
                    '/search/',
                    'search.html',
                    
                    # Bing specific navigation/tool links
                    'bing.com/chat',
                    'bing.com/maps',
                    'bing.com/shop',
                    'bing.com/images',
                    'bing.com/videos',
                    
                    # Google News navigation
                    'news.google.com/?hl=',
                    'news.google.com/home',
                    'news.google.com/topics',
                    'news.google.com/read',
                    
                    # JavaScript links
                    'javascript:void',
                    'javascript:',
                    
                    # Common navigation elements
                    '/home',
                    '/news',
                    '/health',
                    '/more',
                    
                    # Microsoft help/legal/privacy pages
                    'go.microsoft.com/fwlink',
                    'support.microsoft.com',
                    
                    # Image links
                    '.jpg', '.jpeg', '.png', '.gif', '.webp',
                    'images/search',
                    'th.bing.com/th',
                    'gstatic.com/favicon',
                    
                    # Incomplete or malformed URLs
                    'US&gl=US&ceid=US',
                    '&hl=en-US&gl=US',
                    '![]'
                ]
                
                # Check if this is a non-source URL
                is_non_source_url = any(pattern in url_found for pattern in non_source_patterns)
                
                # Also check for very short URLs or titles which are likely not valid content sources
                if is_non_source_url or len(url_found) < 15 or len(title) < 5:
                    logger.info(f"Filtering out non-source URL: {url_found}")
                    continue
                
                # Additional check to ensure we're not getting intermediate redirects or incomplete URLs
                if any(redirect in url_found for redirect in ['bing.com/ck/a', 'google.com/url?', 'click.']) or not url_found.startswith('http'):
                    logger.info(f"Filtering out redirect or invalid URL: {url_found}")
                    continue
                    
                # No longer prioritizing specific news sources
                # All relevant results will be included
                
                # Log the URLs we're keeping
                logger.info(f"Adding result: {title} | {url_found}")

                # Clean up content
                content = re.sub(r'\s*\n\s*', ' ', content)  # Replace newlines with spaces
                content = content.replace('...', '').strip()

                if title and url_found and content:
                    local_results.append(SearchResult(
                        title=title,
                        url=url_found,
                        content=content
                    ))
    except Exception as e:
        logger.error(f"Error crawling or parsing {url}: {str(e)}")

    return local_results

@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    logger.info(f"Received search request for query: {request.query}")
    
    try:
        # Create search URLs based on the query
        # Sanitize the query to remove quotes, which allows for a broader search
        # and prevents the "no results found" issue for fabricated quotes.
        sanitized_query = request.query.replace('"', '').replace("'", "")
        
        # Simplified search URLs with only Bing and Google
        search_urls = [
            f"https://www.bing.com/search?q={sanitized_query.replace(' ', '+')}",
            f"https://www.bing.com/news/search?q={sanitized_query.replace(' ', '+')}",
            f"https://news.google.com/search?q={sanitized_query.replace(' ', '+')}"
        ]
        
        all_results = []
        
        # Use AsyncWebCrawler to fetch and process search results concurrently
        async with AsyncWebCrawler() as crawler:
            tasks = [crawl_and_process(url, crawler, request.max_results) for url in search_urls]
            results_from_all_engines = await asyncio.gather(*tasks)
            
            # Flatten the list of lists
            for res_list in results_from_all_engines:
                all_results.extend(res_list)
        
        # Deduplicate results by URL
        unique_results = {}
        for result in all_results:
            if result.url not in unique_results:
                unique_results[result.url] = result
        
        deduplicated_results = list(unique_results.values())
        
        # If we still don't have enough results, try additional sources
        if len(deduplicated_results) < 2:
            try:
                # Try a direct search on a news aggregator
                additional_urls = [
                    f"https://news.yahoo.com/search?p={sanitized_query.replace(' ', '+')}",
                    f"https://www.theguardian.com/search?q={sanitized_query.replace(' ', '+')}"
                ]
                
                logger.info(f"Not enough results, trying additional sources: {additional_urls}")
                
                async with AsyncWebCrawler() as crawler:
                    tasks = [crawl_and_process(url, crawler, request.max_results) for url in additional_urls]
                    additional_results = await asyncio.gather(*tasks)
                    
                    # Add new results
                    for res_list in additional_results:
                        for result in res_list:
                            if result.url not in unique_results:
                                unique_results[result.url] = result
                
                deduplicated_results = list(unique_results.values())
            except Exception as e:
                logger.error(f"Error in additional sources search: {str(e)}")
        
        # If we still don't have results, try Wikipedia as a fallback
        if not deduplicated_results:
            try:
                # Extract key terms for Wikipedia search
                key_terms = ' '.join([term for term in sanitized_query.split() if len(term) > 3])
                topic_url = f"https://en.wikipedia.org/wiki/{key_terms.replace(' ', '_')}"
                logger.info(f"No search results found, trying direct topic crawl: {topic_url}")
                
                async with AsyncWebCrawler() as crawler:
                    config = CrawlerRunConfig(
                        word_count_threshold=10,
                        verbose=True
                        # Using only supported parameters for your Crawl4AI version
                    )
                    
                    result = await crawler.arun(url=topic_url, config=config)
                    
                    if result and result.success:
                        # Extract markdown content
                        markdown_content = ""
                        if isinstance(result.markdown, str):
                            markdown_content = result.markdown
                        else:
                            markdown_content = result.markdown.raw_markdown
                        
                        # Extract a summary from the markdown
                        summary = markdown_content[:1000] + "..." if len(markdown_content) > 1000 else markdown_content
                        
                        deduplicated_results.append(SearchResult(
                            title=f"Information about {request.query}",
                            url=topic_url,
                            content=summary
                        ))
            except Exception as e:
                logger.error(f"Error in direct topic crawl: {str(e)}")
        
        # Return the results
        if deduplicated_results:
            logger.info(f"Returning {len(deduplicated_results)} results to the search API")
            for i, result in enumerate(deduplicated_results):
                logger.info(f"Result {i+1}: {result.title} | {result.url}")
            return SearchResponse(results=deduplicated_results)
        else:
            logger.info("No results found, returning empty response")
            return SearchResponse(
                results=[],
                error="No relevant information found. The query might be too specific or recent."
            )
            
    except Exception as e:
        logger.error(f"Error processing search request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "crawl4ai_search"}

if __name__ == "__main__":
    uvicorn.run("crawl4ai_service:app", host="0.0.0.0", port=3002, reload=True)