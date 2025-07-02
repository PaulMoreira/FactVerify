import asyncio
import json
import logging
import re
from typing import Dict, List, Optional, Tuple

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
    category: Optional[str] = None

async def crawl_and_process(url: str, crawler: AsyncWebCrawler, max_results: int) -> List[SearchResult]:
    """Crawls a single URL and processes the results with robust regex parsing."""
    local_results = []
    try:
        logger.info(f"Crawling: {url}")
        config = CrawlerRunConfig(word_count_threshold=10, verbose=True)
        result = await crawler.arun(url=url, config=config)

        if result and result.markdown:
            # Regex to find search result blocks with title, URL, and snippet
            # This looks for a markdown link, followed by a URL, and then a text snippet.
            pattern = re.compile(
                r'## \[(.*?)\]\((.*?)\)\n(.*?)(?=\n## |$)',
                re.DOTALL
            )
            matches = pattern.findall(result.markdown)

            for match in matches:
                if len(local_results) >= max_results:
                    break

                title = match[0].strip()
                url_found = match[1].strip()
                content = match[2].strip()

                # Filter out irrelevant search results
                # Filter out irrelevant search results from search engines themselves
                if ('msn.com/en-us/news/search' in url_found or 'news.yahoo.com/search' in url_found or
                    'news.google.com/search' in url_found or 'apnews.com/search' in url_found or
                    'reuters.com/search' in url_found or 'npr.org/search' in url_found or
                    'techcrunch.com/search' in url_found or 'theverge.com/search' in url_found or
                    'wired.com/search' in url_found or 'arstechnica.com/search' in url_found or
                    'engadget.com/search' in url_found or 'cnet.com/search' in url_found or
                    'zdnet.com/search' in url_found or 'webmd.com/search' in url_found or
                    'mayoclinic.org/search' in url_found or 'nih.gov/search' in url_found or
                    'cdc.gov/search' in url_found or 'healthline.com/search' in url_found or
                    'scientificamerican.com/search' in url_found or 'nature.com/search' in url_found or
                    'science.org/action/doSearch' in url_found or 'newscientist.com/search' in url_found or
                    'phys.org/search' in url_found or 'bloomberg.com/search' in url_found or
                    'wsj.com/search' in url_found or 'forbes.com/search' in url_found or
                    'cnbc.com/search' in url_found or 'ft.com/search' in url_found or
                    'wikipedia.org/w/index.php?search' in url_found):
                    continue

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

def detect_category(query: str) -> str:
    """Detect the category of a query based on keyword matching."""
    # Define category keywords
    categories = {
        "tech": ["app", "software", "device", "phone", "computer", "tech", "technology", "digital", 
                "product", "release", "launch", "update", "version", "feature", "platform", "mobile",
                "app store", "google play", "download", "ios", "android", "windows", "mac", "laptop",
                "tablet", "gadget", "hardware", "interface", "cursor", "browser", "website", "internet"],
        "politics": ["government", "election", "president", "congress", "senate", "bill", "law", 
                    "policy", "politician", "vote", "campaign", "democrat", "republican", "political",
                    "administration", "party", "candidate", "ballot", "legislation", "governor", "mayor",
                    "representative", "senator", "official", "white house", "parliament", "court", "justice"],
        "health": ["medical", "health", "disease", "treatment", "doctor", "hospital", "medicine", 
                  "vaccine", "cure", "symptom", "diagnosis", "patient", "healthcare", "virus",
                  "pandemic", "epidemic", "infection", "drug", "therapy", "surgery", "diet", "exercise",
                  "wellness", "mental health", "nutrition", "illness", "condition", "syndrome"],
        "science": ["research", "study", "scientist", "discovery", "experiment", "theory", 
                   "scientific", "physics", "chemistry", "biology", "astronomy", "space",
                   "laboratory", "data", "evidence", "hypothesis", "analysis", "journal", "publication",
                   "innovation", "breakthrough", "technology", "engineering", "mathematics", "climate"],
        "business": ["company", "business", "market", "stock", "investment", "profit", "revenue", 
                    "startup", "corporation", "industry", "economic", "finance", "CEO", "investor",
                    "entrepreneur", "venture", "capital", "funding", "acquisition", "merger", "IPO",
                    "earnings", "quarterly", "fiscal", "shares", "dividend", "portfolio", "assets"]
    }
    
    # Normalize query
    query_lower = query.lower()
    
    # Count category keyword matches
    category_scores = {}
    for category, keywords in categories.items():
        score = sum(1 for keyword in keywords if keyword in query_lower)
        category_scores[category] = score
    
    # Get the category with the highest score
    best_category = max(category_scores.items(), key=lambda x: x[1])
    
    # If no clear category is detected, default to "general"
    if best_category[1] == 0:
        return "general"
    
    return best_category[0]

def get_search_urls(query: str, category: str) -> List[str]:
    """Get category-specific search URLs for a query."""
    sanitized_query = query.replace('"', '').replace("'", "")
    query_param = sanitized_query.replace(' ', '+')
    
    # Common search engines for all categories
    common_urls = [
        f"https://www.bing.com/search?q={query_param}",
        f"https://news.google.com/search?q={query_param}"
    ]
    
    # Category-specific sources
    category_urls = {
        "tech": [
            f"https://techcrunch.com/search/{query_param}/",
            f"https://www.theverge.com/search?q={query_param}",
            f"https://www.wired.com/search/?query={query_param}&page=1&sort=score",
            f"https://arstechnica.com/search/?query={query_param}",
            f"https://www.engadget.com/search/?q={query_param}",
            f"https://www.cnet.com/search/?query={query_param}",
            f"https://www.zdnet.com/search/?q={query_param}"
        ],
        "politics": [
            f"https://www.politico.com/search?q={query_param}",
            f"https://www.apnews.com/search?q={query_param}",
            f"https://www.reuters.com/search/news?blob={query_param}",
            f"https://www.npr.org/search?query={query_param}",
            f"https://www.washingtonpost.com/newssearch/?query={query_param}",
            f"https://www.nytimes.com/search?query={query_param}"
        ],
        "health": [
            f"https://www.webmd.com/search/search_results/default.aspx?query={query_param}",
            f"https://www.mayoclinic.org/search/search-results?q={query_param}",
            f"https://www.nih.gov/search?query={query_param}",
            f"https://www.cdc.gov/search/?query={query_param}",
            f"https://www.healthline.com/search?q1={query_param}"
        ],
        "science": [
            f"https://www.scientificamerican.com/search/?q={query_param}",
            f"https://www.nature.com/search?q={query_param}",
            f"https://www.science.org/action/doSearch?AllField={query_param}",
            f"https://www.newscientist.com/search/?search={query_param}",
            f"https://phys.org/search/?search={query_param}"
        ],
        "business": [
            f"https://www.bloomberg.com/search?query={query_param}",
            f"https://www.wsj.com/search?query={query_param}",
            f"https://www.forbes.com/search/?q={query_param}",
            f"https://www.cnbc.com/search/?query={query_param}",
            f"https://www.ft.com/search?q={query_param}"
        ],
        "general": [
            f"https://www.msn.com/en-us/news/search?q={query_param}",
            f"https://news.yahoo.com/search?p={query_param}",
            f"https://en.wikipedia.org/w/index.php?search={query_param}"
        ]
    }
    
    # Combine common URLs with category-specific URLs
    return common_urls + category_urls.get(category, category_urls["general"])

def generate_query_variations(query: str, category: str) -> List[str]:
    """Generate variations of the query based on the category."""
    variations = [query]  # Always include the original query
    
    # Add category-specific variations
    if category == "tech":
        variations.extend([
            f"{query} release",
            f"{query} app",
            f"{query} mobile",
            f"{query} launch",
            f"{query} available",
            f"{query} download"
        ])
    elif category == "politics":
        variations.extend([
            f"{query} statement",
            f"{query} policy",
            f"{query} announcement",
            f"{query} fact check"
        ])
    elif category == "health":
        variations.extend([
            f"{query} treatment",
            f"{query} symptoms",
            f"{query} cure",
            f"{query} research"
        ])
    elif category == "science":
        variations.extend([
            f"{query} study",
            f"{query} research",
            f"{query} discovery",
            f"{query} findings"
        ])
    elif category == "business":
        variations.extend([
            f"{query} company",
            f"{query} stock",
            f"{query} market",
            f"{query} announcement"
        ])
    
    return variations

@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    logger.info(f"Received search request for query: {request.query}")
    
    try:
        # Detect the category of the query
        category = detect_category(request.query)
        logger.info(f"Detected category for query '{request.query}': {category}")
        
        # Get category-specific search URLs
        search_urls = get_search_urls(request.query, category)
        
        all_results = []
        
        # Use AsyncWebCrawler to fetch and process search results concurrently
        async with AsyncWebCrawler() as crawler:
            tasks = [crawl_and_process(url, crawler, request.max_results) for url in search_urls]
            results_from_all_engines = await asyncio.gather(*tasks)
            
            # Flatten the list of lists
            for res_list in results_from_all_engines:
                all_results.extend(res_list)
        
        # If we didn't get any results, try fallback strategies
        if not all_results:
            # Try Wikipedia as a fallback
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
                
            # If still no results, try query variations
            if not all_results:
                logger.info(f"No results found with original query, trying variations")
                variations = generate_query_variations(request.query, category)
                for variation in variations[:3]:  # Limit to top 3 variations to avoid too many requests
                    logger.info(f"Trying query variation: {variation}")
                    try:
                        variation_urls = get_search_urls(variation, category)[:3]  # Limit to top 3 sources
                        async with AsyncWebCrawler() as crawler:
                            for url in variation_urls:
                                logger.info(f"Crawling variation URL: {url}")
                                result_list = await crawl_and_process(url, crawler, 2)  # Limit to top 2 results
                                all_results.extend(result_list)
                                if all_results:
                                    logger.info(f"Found results with variation: {variation}")
                                    break
                    except Exception as e:
                        logger.error(f"Error in variation search: {str(e)}")
                    
                    if all_results:
                        break
        
        # Return the results
        if all_results:
            return SearchResponse(results=all_results, category=category)
        else:
            return SearchResponse(
                results=[],
                error="No relevant information found. The query might be too specific or recent.",
                category=category
            )
            
    except Exception as e:
        logger.error(f"Error processing search request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "crawl4ai_search"}

if __name__ == "__main__":
    uvicorn.run("crawl4ai_service:app", host="0.0.0.0", port=3002, reload=True)
