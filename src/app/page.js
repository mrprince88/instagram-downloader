"use client";

import { useState } from "react";
import styles from "./page.module.css";
import { fetchPostInfo } from "./actions";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const data = await fetchPostInfo(url);

    if (data.error) {
      setError(data.error);
    } else {
      setResult(data);
    }
    setLoading(false);
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={`${styles.title} gradient-text`}>
            Instagram Downloader
          </h1>
          <p className={styles.description}>
            Paste a link to download photos and videos instantly.
          </p>
        </div>

        <div className={styles.formContainer}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <input
              type="url"
              placeholder="Paste Instagram URL here..."
              className={styles.input}
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? "Fetching..." : "Download"}
            </button>
          </form>
        </div>

        <div className={styles.results}>
          {error && <p className={styles.error}>{error}</p>}

          {result && result.media && (
            <div className={styles.grid}>
              {result.media.map((item, index) => (
                <div key={index} className={styles.card}>
                  <div className={styles.mediaContainer}>
                    {item.type === "video" ? (
                      <video controls className={styles.media} src={item.url} poster={item.thumbnail} />
                    ) : (
                      <img src={item.url} alt={`Instagram Media ${index + 1}`} className={styles.media} />
                    )}
                  </div>
                  <div className={styles.cardActions}>
                    <a href={item.url} download target="_blank" rel="noopener noreferrer" className={styles.downloadBtn}>
                      Download {item.type === "video" ? "Video" : "Image"} {result.media.length > 1 ? `#${index + 1}` : ""}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!result && !error && !loading && (
            <p className={styles.placeholder}>
              Content will appear here...
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
