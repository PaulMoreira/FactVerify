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
    """Crawls a single URL and processes the results."""
    local_results = []
    try:
        logger.info(f"Crawling: {url}")
        
        # Configure the crawler
        config = CrawlerRunConfig(
            word_count_threshold=5,  # Minimum words per element
            wait_for="css:body",  # Wait for body element to be loaded
            verbose=True  # Enable verbose logging
        )
        
        # Run the crawler
        result = await crawler.arun(url=url, config=config)
        
        # Process the search results
        if result and result.markdown:
            # Extract relevant information from the markdown
            content_parts = result.markdown.split("\n\n")
            
            # Process search results to extract titles, URLs, and snippets
            for i, part in enumerate(content_parts):
                if i >= max_results:
                    break
                    
                # Create a result entry with available information
                title = f"Search Result {i+1}"
                url_found = ""
                content = part
                
                # Try to extract URL if present - improved extraction
                if "http" in part:
                    # Find all URLs in the content
                    url_pattern = r'https?://[^\s()<>"]+'
                    found_urls = re.findall(url_pattern, part)
                    if found_urls:
                        url_found = found_urls[0]  # Take the first URL found
                        # Clean up the URL - remove trailing punctuation
                        url_found = re.sub(r'[.,;:!?)]+$', '', url_found)
                        content = part.replace(url_found, "").strip()
                
                # Try to extract title if present
                if "##" in part:
                    title_line = part.split("\n")[0]
                    title = title_line.replace("#", "").strip()
                    content = part.replace(title_line, "").strip()
                
                if content:  # Only add if there's content
                    local_results.append(SearchResult(
                        title=title,
                        url=url_found or "No URL available",
                        content=content
                    ))
    except Exception as e:
        logger.error(f"Error crawling {url}: {str(e)}")
    
    return local_results

@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    logger.info(f"Received search request for query: {request.query}")
    
    try:
        # Create search URLs based on the query
        # Switching to DuckDuckGo to avoid Google's CAPTCHA blocks on Render.
        search_urls = [
            f"https://duckduckgo.com/?q={request.query.replace(' ', '+')}&t=h_&ia=web"
        ]
        
        all_results = []
        
        # Use AsyncWebCrawler to fetch and process search results concurrently
        async with AsyncWebCrawler() as crawler:
            tasks = [crawl_and_process(url, crawler, request.max_results) for url in search_urls]
            results_from_all_engines = await asyncio.gather(*tasks)
            
            # Flatten the list of lists
            for res_list in results_from_all_engines:
                all_results.extend(res_list)
        
        # If we didn't get any results, try to crawl directly for the query topic
        if not all_results:
            try:
                topic_url = f"https://en.wikipedia.org/wiki/{request.query.replace(' ', '_')}"
                logger.info(f"No search results found, trying direct topic crawl: {topic_url}")
                
                async with AsyncWebCrawler() as crawler:
                    config = CrawlerRunConfig(
                        word_count_threshold=10,
                        verbose=True
                    )
                    
                    result = await crawler.arun(url=topic_url, config=config)
                    
                    if result and result.markdown:
                        # Extract a summary from the markdown
                        summary = result.markdown[:1000] + "..." if len(result.markdown) > 1000 else result.markdown
                        
                        all_results.append(SearchResult(
                            title=f"Information about {request.query}",
                            url=topic_url,
                            content=summary
                        ))
            except Exception as e:
                logger.error(f"Error in direct topic crawl: {str(e)}")
        
        # Return the results
        if all_results:
            return SearchResponse(results=all_results)
        else:
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
