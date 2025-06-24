import asyncio
import json
import logging
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

@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    logger.info(f"Received search request for query: {request.query}")
    
    try:
        # Create search URLs based on the query
        search_urls = [
            f"https://www.google.com/search?q={request.query.replace(' ', '+')}",
            f"https://duckduckgo.com/?q={request.query.replace(' ', '+')}&t=h_&ia=web",
            f"https://www.bing.com/search?q={request.query.replace(' ', '+')}"
        ]
        
        results = []
        
        # Use AsyncWebCrawler to fetch and process search results
        async with AsyncWebCrawler() as crawler:
            for url in search_urls:  # Search all engines to get more sources
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
                            if i >= request.max_results:
                                break
                                
                            # Create a result entry with available information
                            title = f"Search Result {i+1}"
                            url = ""
                            content = part
                            
                            # Try to extract URL if present - improved extraction
                            if "http" in part:
                                # Find all URLs in the content
                                import re
                                url_pattern = r'https?://[^\s()<>"\\\[\]]+'
                                found_urls = re.findall(url_pattern, part)
                                if found_urls:
                                    url = found_urls[0]  # Take the first URL found
                                    # Clean up the URL - remove trailing punctuation
                                    url = re.sub(r'[.,;:!?)]+$', '', url)
                                    content = part.replace(url, "").strip()
                                else:
                                    # Fallback to basic extraction
                                    url_start = part.find("http")
                                    url_end = part.find(" ", url_start) if part.find(" ", url_start) > 0 else len(part)
                                    url = part[url_start:url_end].strip()
                                    content = part.replace(url, "").strip()
                            
                            # Try to extract title if present
                            if "##" in part:
                                title_line = part.split("\n")[0]
                                title = title_line.replace("#", "").strip()
                                content = part.replace(title_line, "").strip()
                            
                            if content:  # Only add if there's content
                                results.append(SearchResult(
                                    title=title,
                                    url=url or "No URL available",
                                    content=content
                                ))
                except Exception as e:
                    logger.error(f"Error crawling {url}: {str(e)}")
                    continue
        
        # If we didn't get any results, try to crawl directly for the query topic
        if not results:
            try:
                topic_url = f"https://en.wikipedia.org/wiki/{request.query.replace(' ', '_')}"
                logger.info(f"No search results found, trying direct topic crawl: {topic_url}")
                
                config = CrawlerRunConfig(
                    word_count_threshold=10,
                    verbose=True
                )
                
                result = await crawler.arun(url=topic_url, config=config)
                
                if result and result.markdown:
                    # Extract a summary from the markdown
                    summary = result.markdown[:1000] + "..." if len(result.markdown) > 1000 else result.markdown
                    
                    results.append(SearchResult(
                        title=f"Information about {request.query}",
                        url=topic_url,
                        content=summary
                    ))
            except Exception as e:
                logger.error(f"Error in direct topic crawl: {str(e)}")
        
        # Return the results
        if results:
            return SearchResponse(results=results)
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
