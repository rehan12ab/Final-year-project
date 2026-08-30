"""
HackSentinel Vector DB Builder v1.0
====================================
Phase 4: Build ChromaDB vector database for RAG retrieval.

Pipeline:
  1. Load preprocessed_data/cleaned_data.json (315K+ records)
  2. Compute quality scores per record
  3. Chunk long texts (>1000 chars) with overlap
  4. Embed with all-MiniLM-L6-v2 via sentence-transformers
  5. Batch insert into ChromaDB (persistent at vector_db/)
  6. Verify with sample queries per category
  7. Save build report

Input:  preprocessed_data/cleaned_data.json
Output: vector_db/ directory (ChromaDB persistent store)

Categories: XSS, SQLI, SSRF, IDOR, RCE, CSRF, OPEN_REDIRECT, INFO_DISCLOSURE, AUTH_BYPASS, OTHER

Author: HackSentinel
"""

import os
import json
import time
import gc
from collections import Counter

try:
    from colorama import init, Fore, Style
    init(autoreset=True)
    GREEN = Fore.GREEN
    RED = Fore.RED
    YELLOW = Fore.YELLOW
    CYAN = Fore.CYAN
    BRIGHT = Style.BRIGHT
    RESET = Style.RESET_ALL
except ImportError:
    GREEN = RED = YELLOW = CYAN = BRIGHT = RESET = ""

try:
    import chromadb
    from chromadb.config import Settings
except ImportError:
    print("[!] Missing library. Run: pip install chromadb")
    raise SystemExit(1)

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("[!] Missing library. Run: pip install sentence-transformers")
    raise SystemExit(1)


class VectorDBBuilder:
    """Builds a ChromaDB vector database from preprocessed vulnerability writeups."""

    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = os.path.join(SCRIPT_DIR, "preprocessed_data")
    OUTPUT_DIR = os.path.join(SCRIPT_DIR, "vector_db")
    COLLECTION_NAME = "hacksentinel_writeups"
    EMBEDDING_MODEL = "all-MiniLM-L6-v2"
    BATCH_SIZE = 5000  # ChromaDB max is 5461
    CHUNK_SIZE = 500
    CHUNK_OVERLAP = 100

    VALID_CATEGORIES = [
        'XSS', 'SQLI', 'SSRF', 'IDOR', 'RCE',
        'CSRF', 'OPEN_REDIRECT', 'INFO_DISCLOSURE', 'AUTH_BYPASS', 'OTHER'
    ]

    SAMPLE_QUERIES = {
        'XSS': 'reflected cross site scripting XSS payload alert document cookie',
        'SQLI': 'SQL injection union select database extraction blind boolean',
        'SSRF': 'server side request forgery SSRF internal metadata AWS',
        'IDOR': 'insecure direct object reference IDOR access control bypass user ID',
        'RCE': 'remote code execution command injection shell reverse',
        'CSRF': 'cross site request forgery CSRF token bypass state changing',
        'OPEN_REDIRECT': 'open redirect URL redirection phishing unvalidated',
        'INFO_DISCLOSURE': 'information disclosure sensitive data exposure stack trace',
        'AUTH_BYPASS': 'authentication bypass login brute force session token',
        'OTHER': 'vulnerability exploit security bug bounty writeup',
    }

    def __init__(self):
        self.data = []
        self.documents = []  # text chunks to embed
        self.metadatas = []  # metadata per chunk
        self.ids = []        # unique IDs per chunk
        self.embedder = None
        self.client = None
        self.collection = None
        self.stats = {
            'total_records': 0,
            'total_chunks': 0,
            'records_per_category': {},
            'records_per_source': {},
            'quality_distribution': {},
            'chunked_records': 0,
            'embedding_time': 0,
            'insert_time': 0,
            'total_time': 0,
        }

    def run(self):
        """Main entry point."""
        start = time.time()
        print(f"\n{BRIGHT}{CYAN}{'='*60}")
        print(f"  HackSentinel Vector DB Builder v1.0")
        print(f"  Phase 4: Build ChromaDB for RAG Retrieval")
        print(f"{'='*60}{RESET}\n")

        self._load_data()
        self._compute_quality_scores()
        self._chunk_texts()
        self._init_chromadb()
        self._load_embedding_model()
        self._embed_and_insert()
        self._verify()
        self._save_report()

        self.stats['total_time'] = round(time.time() - start, 2)
        print(f"\n{GREEN}{BRIGHT}[+] Phase 4 complete in {self.stats['total_time']}s{RESET}")
        print(f"    Vectors: {self.stats['total_chunks']}")
        print(f"    Location: {self.OUTPUT_DIR}/")

    # ──────────────────────────────────────────────
    # Step 1: Load Data
    # ──────────────────────────────────────────────

    def _load_data(self):
        """Load preprocessed cleaned_data.json."""
        print(f"{CYAN}[1/8] Loading preprocessed data...{RESET}")

        data_path = os.path.join(self.DATA_DIR, "cleaned_data.json")
        if not os.path.exists(data_path):
            print(f"{RED}[!] File not found: {data_path}{RESET}")
            raise SystemExit(1)

        with open(data_path, 'r', encoding='utf-8') as f:
            self.data = json.load(f)

        self.stats['total_records'] = len(self.data)
        print(f"    Loaded {GREEN}{len(self.data):,}{RESET} records")

        # Stats by category
        cat_counts = Counter(r.get('category', 'OTHER') for r in self.data)
        self.stats['records_per_category'] = dict(cat_counts.most_common())
        print(f"\n    {'Category':<20} {'Count':>8}")
        print(f"    {'-'*30}")
        for cat, count in cat_counts.most_common():
            print(f"    {cat:<20} {count:>8,}")

        # Stats by source
        src_counts = Counter(r.get('source', 'unknown') for r in self.data)
        self.stats['records_per_source'] = dict(src_counts.most_common())
        print(f"\n    {'Source':<20} {'Count':>8}")
        print(f"    {'-'*30}")
        for src, count in src_counts.most_common():
            print(f"    {src:<20} {count:>8,}")
        print()

    # ──────────────────────────────────────────────
    # Step 2: Quality Scores
    # ──────────────────────────────────────────────

    def _compute_quality_scores(self):
        """Score each record 0-10 based on content richness."""
        print(f"{CYAN}[2/8] Computing quality scores...{RESET}")

        for rec in self.data:
            score = 0
            wc = rec.get('word_count', 0)

            # Word count bonus
            if wc > 500:
                score += 4
            elif wc > 200:
                score += 3
            elif wc > 100:
                score += 2

            # Has payload
            if rec.get('has_payload', False):
                score += 2

            # High-value source
            if rec.get('source', '') in ('hackerone_scraped', 'hackerone_hf', 'medium', 'github'):
                score += 2

            # Has CWE
            if rec.get('has_cwe', False):
                score += 1

            # Has bounty
            if rec.get('has_bounty', False):
                score += 1

            rec['quality_score'] = min(score, 10)

        # Quality distribution
        quality_counts = Counter(r['quality_score'] for r in self.data)
        self.stats['quality_distribution'] = {str(k): v for k, v in sorted(quality_counts.items())}

        print(f"\n    {'Score':<8} {'Count':>10} {'Bar'}")
        print(f"    {'-'*40}")
        max_count = max(quality_counts.values()) if quality_counts else 1
        for score in range(11):
            count = quality_counts.get(score, 0)
            bar_len = int(30 * count / max_count) if max_count else 0
            bar = '#' * bar_len
            print(f"    {score:<8} {count:>10,}  {bar}")

        avg_q = sum(r['quality_score'] for r in self.data) / len(self.data) if self.data else 0
        print(f"\n    Average quality: {GREEN}{avg_q:.2f}{RESET}")
        print()

    # ──────────────────────────────────────────────
    # Step 3: Chunk Long Texts
    # ──────────────────────────────────────────────

    def _chunk_texts(self):
        """Split long texts into overlapping chunks; short texts pass through."""
        print(f"{CYAN}[3/8] Chunking texts...{RESET}")

        chunked_count = 0
        for idx, rec in enumerate(self.data):
            text = rec.get('combined_text', '').strip()
            if not text:
                continue

            category = rec.get('category', 'OTHER')
            source = rec.get('source', 'unknown')
            quality = rec.get('quality_score', 0)

            metadata = {
                'category': category,
                'severity': rec.get('severity', 'unknown'),
                'source': source,
                'cwe_id': rec.get('cwe_id', ''),
                'has_payload': rec.get('has_payload', False),
                'word_count': rec.get('word_count', 0),
                'quality_score': quality,
                'title': (rec.get('title', '') or '')[:200],
                'url': (rec.get('url', '') or '')[:500],
                'parent_index': idx,
            }

            if len(text) > 1000:
                # Chunk with overlap
                chunks = self._split_text(text)
                chunked_count += 1
                for ci, chunk in enumerate(chunks):
                    chunk_meta = dict(metadata)
                    chunk_meta['chunk_index'] = ci
                    chunk_meta['total_chunks'] = len(chunks)
                    self.documents.append(chunk)
                    self.metadatas.append(chunk_meta)
                    self.ids.append(f"rec_{idx}_chunk_{ci}")
            else:
                metadata['chunk_index'] = 0
                metadata['total_chunks'] = 1
                self.documents.append(text)
                self.metadatas.append(metadata)
                self.ids.append(f"rec_{idx}_chunk_0")

        self.stats['total_chunks'] = len(self.documents)
        self.stats['chunked_records'] = chunked_count

        print(f"    Total chunks: {GREEN}{len(self.documents):,}{RESET}")
        print(f"    Records that needed chunking: {chunked_count:,}")
        print(f"    Average chunk length: {sum(len(d) for d in self.documents) / len(self.documents):.0f} chars")
        print()

    def _split_text(self, text: str) -> list:
        """Split text into overlapping chunks."""
        chunks = []
        start = 0
        while start < len(text):
            end = start + self.CHUNK_SIZE
            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk.strip())
            start += self.CHUNK_SIZE - self.CHUNK_OVERLAP
        return chunks if chunks else [text.strip()]

    # ──────────────────────────────────────────────
    # Step 4: Initialize ChromaDB
    # ──────────────────────────────────────────────

    def _init_chromadb(self):
        """Initialize persistent ChromaDB client and create collection."""
        print(f"{CYAN}[4/8] Initializing ChromaDB at {self.OUTPUT_DIR}/...{RESET}")

        os.makedirs(self.OUTPUT_DIR, exist_ok=True)

        self.client = chromadb.PersistentClient(path=self.OUTPUT_DIR)

        # Delete existing collection if present (fresh build)
        try:
            self.client.delete_collection(self.COLLECTION_NAME)
            print(f"    Deleted existing collection '{self.COLLECTION_NAME}'")
        except Exception:
            pass

        self.collection = self.client.create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}
        )
        print(f"    Created collection '{self.COLLECTION_NAME}' (cosine similarity)")
        print()

    # ──────────────────────────────────────────────
    # Step 5: Load Embedding Model
    # ──────────────────────────────────────────────

    def _load_embedding_model(self):
        """Load sentence-transformers embedding model."""
        print(f"{CYAN}[5/8] Loading embedding model '{self.EMBEDDING_MODEL}'...{RESET}")
        t0 = time.time()
        self.embedder = SentenceTransformer(self.EMBEDDING_MODEL)
        print(f"    Model loaded in {time.time() - t0:.1f}s")
        print(f"    Embedding dimension: {self.embedder.get_sentence_embedding_dimension()}")
        print()

    # ──────────────────────────────────────────────
    # Step 6: Embed & Insert
    # ──────────────────────────────────────────────

    def _embed_and_insert(self):
        """Batch embed documents and insert into ChromaDB."""
        print(f"{CYAN}[6/8] Embedding and inserting {len(self.documents):,} chunks...{RESET}")

        total = len(self.documents)
        inserted = 0
        embed_time = 0
        insert_time = 0

        for batch_start in range(0, total, self.BATCH_SIZE):
            batch_end = min(batch_start + self.BATCH_SIZE, total)
            batch_docs = self.documents[batch_start:batch_end]
            batch_metas = self.metadatas[batch_start:batch_end]
            batch_ids = self.ids[batch_start:batch_end]

            # Embed
            t0 = time.time()
            embeddings = self.embedder.encode(
                batch_docs,
                show_progress_bar=False,
                batch_size=256,
            ).tolist()
            embed_time += time.time() - t0

            # Insert
            t0 = time.time()
            self.collection.add(
                ids=batch_ids,
                documents=batch_docs,
                embeddings=embeddings,
                metadatas=batch_metas,
            )
            insert_time += time.time() - t0

            inserted += len(batch_docs)
            pct = inserted / total * 100
            print(f"    [{inserted:>8,}/{total:,}] {pct:5.1f}%  "
                  f"(embed: {embed_time:.1f}s, insert: {insert_time:.1f}s)", end='\r')

            # Memory management
            del embeddings
            gc.collect()

        self.stats['embedding_time'] = round(embed_time, 2)
        self.stats['insert_time'] = round(insert_time, 2)

        print(f"\n    Embedding time: {embed_time:.1f}s")
        print(f"    Insert time:    {insert_time:.1f}s")
        print(f"    Total inserted: {GREEN}{inserted:,}{RESET}")
        print()

    # ──────────────────────────────────────────────
    # Step 7: Verify with Sample Queries
    # ──────────────────────────────────────────────

    def _verify(self):
        """Run sample queries per category and print results."""
        print(f"{CYAN}[7/8] Running verification queries...{RESET}\n")

        count = self.collection.count()
        print(f"    Collection count: {GREEN}{count:,}{RESET} vectors\n")

        for cat, query in self.SAMPLE_QUERIES.items():
            results = self.retrieve_writeups(query, category=cat, top_k=3, min_quality=0)
            print(f"    {BRIGHT}{cat}{RESET} - query: \"{query[:50]}...\"")
            if results:
                for i, r in enumerate(results):
                    title = r['metadata'].get('title', 'N/A')[:60]
                    score = r['score']
                    q = r['metadata'].get('quality_score', 0)
                    print(f"      {i+1}. [{score:.3f}] (q={q}) {title}")
            else:
                print(f"      {YELLOW}No results{RESET}")
            print()

    # ──────────────────────────────────────────────
    # Step 8: Save Build Report
    # ──────────────────────────────────────────────

    def _save_report(self):
        """Save build report JSON."""
        print(f"{CYAN}[8/8] Saving build report...{RESET}")

        report = {
            'version': '1.0',
            'build_date': time.strftime('%Y-%m-%d %H:%M:%S'),
            'collection_name': self.COLLECTION_NAME,
            'embedding_model': self.EMBEDDING_MODEL,
            'stats': self.stats,
        }

        report_path = os.path.join(self.OUTPUT_DIR, "build_report.json")
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)

        print(f"    Saved to {report_path}")

        # Print disk size
        total_size = 0
        for dirpath, dirnames, filenames in os.walk(self.OUTPUT_DIR):
            for fname in filenames:
                fp = os.path.join(dirpath, fname)
                total_size += os.path.getsize(fp)
        size_mb = total_size / (1024 * 1024)
        print(f"    Database size: {size_mb:.1f} MB")
        print()

    # ──────────────────────────────────────────────
    # Retrieval Function (used by API)
    # ──────────────────────────────────────────────

    def retrieve_writeups(self, query: str, category: str = None,
                          top_k: int = 15, min_quality: int = 0) -> list:
        """
        Retrieve relevant writeups from the vector database.

        Args:
            query: Search query text
            category: Optional category filter (e.g. 'XSS', 'SQLI')
            top_k: Number of results to return
            min_quality: Minimum quality_score filter

        Returns:
            List of dicts with 'text', 'metadata', 'score' keys,
            sorted by relevance * quality.
        """
        if self.collection is None:
            return []

        # Build where filter
        where_filter = None
        conditions = []
        if category:
            conditions.append({"category": category.upper()})
        if min_quality > 0:
            conditions.append({"quality_score": {"$gte": min_quality}})

        if len(conditions) == 1:
            where_filter = conditions[0]
        elif len(conditions) > 1:
            where_filter = {"$and": conditions}

        # Query with embedding
        query_embedding = self.embedder.encode([query]).tolist()

        try:
            results = self.collection.query(
                query_embeddings=query_embedding,
                n_results=top_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            print(f"{RED}[!] Query error: {e}{RESET}")
            return []

        # Format results (ChromaDB returns cosine distance, convert to similarity)
        output = []
        if results and results['ids'] and results['ids'][0]:
            for i in range(len(results['ids'][0])):
                distance = results['distances'][0][i]
                similarity = 1 - distance  # cosine distance -> similarity

                meta = results['metadatas'][0][i]
                quality = meta.get('quality_score', 0)

                # Combined score: 70% similarity + 30% normalized quality
                combined_score = 0.7 * similarity + 0.3 * (quality / 10.0)

                output.append({
                    'id': results['ids'][0][i],
                    'text': results['documents'][0][i],
                    'metadata': meta,
                    'score': round(combined_score, 4),
                    'similarity': round(similarity, 4),
                })

        # Sort by combined score descending
        output.sort(key=lambda x: x['score'], reverse=True)
        return output


def get_retriever(db_path: str = None):
    """
    Load an existing vector DB for retrieval (used by predict_api.py).
    Returns a VectorDBBuilder instance with collection loaded.
    """
    builder = VectorDBBuilder()
    if db_path:
        builder.OUTPUT_DIR = db_path

    if not os.path.exists(builder.OUTPUT_DIR):
        return None

    builder.client = chromadb.PersistentClient(path=builder.OUTPUT_DIR)
    try:
        builder.collection = builder.client.get_collection(builder.COLLECTION_NAME)
    except Exception:
        return None

    builder.embedder = SentenceTransformer(builder.EMBEDDING_MODEL)
    return builder


if __name__ == "__main__":
    builder = VectorDBBuilder()
    builder.run()
