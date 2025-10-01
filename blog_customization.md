# 🎨 Blog Customization Guide

Complete guide to customizing your Jekyll blog's appearance and functionality.

---

## 🎭 Quick Theme Changes

### Method 1: Use GitHub-Supported Themes (Easiest)

Edit `_config.yml` in your blog repository:

```yaml
title: My Awesome Wiki
description: Auto-generated from Telegram with AI
theme: minima  # Change this line

# Available themes:
# - minima (default, clean)
# - jekyll-theme-cayman (modern, blue)
# - jekyll-theme-minimal (very simple)
# - jekyll-theme-slate (dark)
# - jekyll-theme-architect (professional)
# - jekyll-theme-time-machine (retro)
# - jekyll-theme-leap-day (colorful)
# - jekyll-theme-midnight (dark elegance)
# - jekyll-theme-tactile (touch-friendly)
# - jekyll-theme-dinky (compact)
# - jekyll-theme-hacker (terminal style)
```

Commit and push - GitHub Pages rebuilds automatically!

---

## 🌈 Popular Theme Examples

### 1. Minima (Default - Clean & Modern)

```yaml
# _config.yml
title: My Wiki Blog
description: AI-powered content from Telegram
theme: minima

minima:
  skin: dark  # Options: auto, dark, solarized-dark, solarized
  social_links:
    github: your-username
    twitter: your-handle
```

**Preview:** Clean, responsive, mobile-first

---

### 2. Cayman (Modern Blue)

```yaml
# _config.yml
title: My Wiki Blog
description: Auto-generated content
remote_theme: pages-themes/cayman@v0.2.0

plugins:
  - jekyll-remote-theme
```

**Preview:** Large header, blue gradient, great for projects

---

### 3. Minimal (Ultra Simple)

```yaml
# _config.yml
title: My Wiki
description: Content archive
remote_theme: pages-themes/minimal@v0.2.0

plugins:
  - jekyll-remote-theme
```

**Preview:** Sidebar navigation, perfect for documentation

---

### 4. Hacker (Terminal Style)

```yaml
# _config.yml
title: $ My Wiki Terminal
description: > 
  Hacker-style content archive
remote_theme: pages-themes/hacker@v0.2.0

plugins:
  - jekyll-remote-theme
```

**Preview:** Green text on black, monospace font, developer aesthetic

---

## 🎨 Advanced Theme: Chirpy (Most Popular)

Beautiful, feature-rich theme with dark mode, categories, and search.

### Installation

```yaml
# _config.yml
remote_theme: cotes2020/jekyll-theme-chirpy

timezone: America/Chicago

title: My Wiki Blog
tagline: AI-Powered Content Collection
description: >-
  Auto-generated blog posts from my Telegram channels
  using Google Gemini AI.

url: 'https://your-username.github.io'

github:
  username: your-username

social:
  name: Your Name
  email: your@email.com
  links:
    - https://github.com/your-username
    - https://twitter.com/your-handle

theme_mode: dual  # [light|dark|dual]

avatar: /assets/img/avatar.jpg  # Optional

toc: true  # Table of contents

comments:
  active: giscus  # Options: disqus, utterances, giscus
  
paginate: 10
```

### Create `Gemfile`:

```ruby
source "https://rubygems.org"

gem "jekyll-theme-chirpy", "~> 6.0"

group :test do
  gem "html-proofer", "~> 4.4"
end
```

---

## 🔧 Custom Styling

### Method 1: Custom CSS (Simple)

Create `assets/css/style.scss`:

```scss
---
---

@import "{{ site.theme }}";

/* Custom styles */
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

h1, h2, h3 {
  color: #2c3e50;
}

a {
  color: #3498db;
  text-decoration: none;
  
  &:hover {
    color: #2980b9;
    text-decoration: underline;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  body {
    background-color: #1a1a1a;
    color: #e0e0e0;
  }
  
  h1, h2, h3 {
    color: #ffffff;
  }
}

/* Responsive images */
img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

/* Code blocks */
pre {
  background: #f6f8fa;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
}

/* Custom post cards */
.post-card {
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 20px;
  margin-bottom: 20px;
  transition: box-shadow 0.3s;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
}
```

---

### Method 2: Custom Layouts

Create `_layouts/post.html`:

```html
---
layout: default
---

<article class="post h-entry" itemscope itemtype="http://schema.org/BlogPosting">
  
  <header class="post-header">
    <h1 class="post-title p-name" itemprop="name headline">
      {{ page.title | escape }}
    </h1>
    
    <div class="post-meta">
      <time class="dt-published" datetime="{{ page.date | date_to_xmlschema }}" itemprop="datePublished">
        {{ page.date | date: "%B %-d, %Y" }}
      </time>
      
      {% if page.categories %}
        <span class="post-categories">
          {% for category in page.categories %}
            <a href="/categories/{{ category }}">{{ category }}</a>
          {% endfor %}
        </span>
      {% endif %}
    </div>
  </header>

  <div class="post-content e-content" itemprop="articleBody">
    {{ content }}
  </div>

  <footer class="post-footer">
    <div class="share-buttons">
      <a href="https://twitter.com/intent/tweet?text={{ page.title | url_encode }}&url={{ page.url | absolute_url }}" target="_blank">
        Share on Twitter
      </a>
    </div>
    
    {% if page.tags %}
      <div class="post-tags">
        {% for tag in page.tags %}
          <span class="tag">{{ tag }}</span>
        {% endfor %}
      </div>
    {% endif %}
  </footer>

</article>
```

---

## 📝 Custom Home Page

Create `index.html`:

```html
---
layout: default
title: Home
---

<div class="home">
  <h1>Welcome to My Wiki</h1>
  <p class="tagline">
    Auto-generated content from my Telegram channels using AI
  </p>

  <div class="stats">
    <span class="stat-item">
      <strong>{{ site.posts.size }}</strong> Posts
    </span>
    <span class="stat-item">
      <strong>{{ site.categories.size }}</strong> Categories
    </span>
  </div>

  <div class="recent-posts">
    <h2>Recent Posts</h2>
    {% for post in site.posts limit:10 %}
      <article class="post-preview">
        <h3>
          <a href="{{ post.url | relative_url }}">
            {{ post.title | escape }}
          </a>
        </h3>
        <div class="post-excerpt">
          {{ post.excerpt | strip_html | truncatewords: 50 }}
        </div>
        <div class="post-meta">
          <time datetime="{{ post.date | date_to_xmlschema }}">
            {{ post.date | date: "%b %-d, %Y" }}
          </time>
        </div>
      </article>
    {% endfor %}
  </div>

  <div class="categories-list">
    <h2>Browse by Category</h2>
    {% for category in site.categories %}
      <a href="/categories/{{ category[0] }}" class="category-tag">
        {{ category[0] }} ({{ category[1].size }})
      </a>
    {% endfor %}
  </div>
</div>
```

---

## 🎯 Add Custom Features

### 1. Search Functionality

Add to `_config.yml`:

```yaml
plugins:
  - jekyll-feed
  - jekyll-seo-tag
  - jekyll-sitemap

# Simple search
simple_search: true
```

Create `search.html`:

```html
---
layout: default
title: Search
---

<div class="search-container">
  <input type="text" id="search-input" placeholder="Search posts...">
  <ul id="search-results"></ul>
</div>

<script src="/assets/js/simple-jekyll-search.min.js"></script>
<script>
  SimpleJekyllSearch({
    searchInput: document.getElementById('search-input'),
    resultsContainer: document.getElementById('search-results'),
    json: '/search.json',
    searchResultTemplate: '<li><a href="{url}">{title}</a></li>'
  })
</script>
```

Create `search.json`:

```liquid
---
layout: none
---
[
  {% for post in site.posts %}
    {
      "title": "{{ post.title | escape }}",
      "category": "{{ post.category }}",
      "tags": "{{ post.tags | join: ', ' }}",
      "url": "{{ site.baseurl }}{{ post.url }}",
      "date": "{{ post.date | date: '%B %-d, %Y' }}",
      "content": {{ post.content | strip_html | jsonify }}
    }{% unless forloop.last %},{% endunless %}
  {% endfor %}
]
```

---

### 2. Categories Page

Create `categories.html`:

```html
---
layout: default
title: Categories
---

<div class="categories-page">
  <h1>All Categories</h1>
  
  {% for category in site.categories %}
    <div class="category-section">
      <h2 id="{{ category[0] }}">{{ category[0] }}</h2>
      <ul class="post-list">
        {% for post in category[1] %}
          <li>
            <span class="post-date">{{ post.date | date: "%b %-d, %Y" }}</span>
            <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
          </li>
        {% endfor %}
      </ul>
    </div>
  {% endfor %}
</div>
```

---

### 3. Archive Page

Create `archive.html`:

```html
---
layout: default
title: Archive
---

<div class="archive">
  <h1>Post Archive</h1>
  
  {% for post in site.posts %}
    {% assign currentYear = post.date | date: "%Y" %}
    {% assign currentMonth = post.date | date: "%B" %}
    
    {% if currentYear != year %}
      {% unless forloop.first %}</ul>{% endunless %}
      <h2>{{ currentYear }}</h2>
      <ul>
      {% assign year = currentYear %}
    {% endif %}
    
    {% if currentMonth != month %}
      <h3>{{ currentMonth }}</h3>
      {% assign month = currentMonth %}
    {% endif %}
    
    <li>
      <span>{{ post.date | date: "%b %-d" }}</span>
      <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
    </li>
    
    {% if forloop.last %}</ul>{% endif %}
  {% endfor %}
</div>
```

---

### 4. Related Posts

Add to your `_layouts/post.html`:

```html
{% if site.related_posts.size > 0 %}
  <div class="related-posts">
    <h3>Related Posts</h3>
    <ul>
      {% for post in site.related_posts limit:3 %}
        <li>
          <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
        </li>
      {% endfor %}
    </ul>
  </div>
{% endif %}
```

---

## 🖼️ Add Custom Fonts

Create `_includes/head.html`:

```html
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Fira+Code:wght@400;600&display=swap" rel="stylesheet">
  
  <title>{% if page.title %}{{ page.title | escape }}{% else %}{{ site.title | escape }}{% endif %}</title>
  <meta name="description" content="{{ page.excerpt | default: site.description | strip_html | normalize_whitespace | truncate: 160 | escape }}">
  
  <link rel="stylesheet" href="{{ "/assets/css/style.css" | relative_url }}">
</head>
```

Update `assets/css/style.scss`:

```scss
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

code, pre {
  font-family: 'Fira Code', Monaco, 'Courier New', monospace;
}
```

---

## 🌙 Dark Mode Toggle

Add to `_includes/header.html`:

```html
<header class="site-header">
  <div class="wrapper">
    <a class="site-title" href="{{ "/" | relative_url }}">{{ site.title }}</a>
    
    <button id="theme-toggle" aria-label="Toggle dark mode">
      <span class="sun-icon">☀️</span>
      <span class="moon-icon">🌙</span>
    </button>
  </div>
</header>

<script>
  const toggle = document.getElementById('theme-toggle');
  const html = document.documentElement;
  
  // Check for saved preference
  const currentTheme = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', currentTheme);
  
  toggle.addEventListener('click', () => {
    const theme = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  });
</script>
```

Add CSS:

```scss
:root {
  --bg-color: #ffffff;
  --text-color: #24292e;
  --link-color: #0366d6;
}

[data-theme="dark"] {
  --bg-color: #0d1117;
  --text-color: #c9d1d9;
  --link-color: #58a6ff;
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
  transition: background-color 0.3s, color 0.3s;
}

a {
  color: var(--link-color);
}
```

---

## 📱 Mobile Optimization

Add to `_config.yml`:

```yaml
mobile:
  enabled: true
  viewport_width: device-width
  initial_scale: 1.0
```

Add responsive CSS:

```scss
/* Mobile-first approach */
.container {
  padding: 1rem;
  max-width: 100%;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
    max-width: 740px;
    margin: 0 auto;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    max-width: 980px;
  }
}

/* Touch-friendly buttons */
button, a.button {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 24px;
}
```

---

## 🚀 Performance Optimization

### 1. Image Optimization

Add to bot's `publishToGitHub` function:

```typescript
// In src/index.ts
markdownContent += '\n\n## Images\n\n';
mediaUrls.forEach((url, index) => {
  markdownContent += `![Image ${index + 1}](${url}){: loading="lazy" width="800"}\n\n`;
});
```

### 2. Add PWA Support

Create `manifest.json`:

```json
{
  "name": "My Wiki Blog",
  "short_name": "Wiki",
  "description": "Auto-generated blog from Telegram",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0366d6",
  "icons": [
    {
      "src": "/assets/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/assets/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## 🎉 Example: Complete Custom Theme

Here's a complete example combining many customizations:

```yaml
# _config.yml
title: My Tech Wiki
description: AI-powered technical notes from Telegram
author: Your Name
email: your@email.com

url: "https://your-username.github.io"
baseurl: "/my-wiki-blog"

theme: minima

minima:
  skin: dark
  social_links:
    github: your-username
    twitter: your-handle

plugins:
  - jekyll-feed
  - jekyll-seo-tag
  - jekyll-sitemap
  - jekyll-paginate

paginate: 10
paginate_path: "/page/:num/"

# Collections
collections:
  tutorials:
    output: true
    permalink: /:collection/:name

# Defaults
defaults:
  - scope:
      path: ""
      type: "posts"
    values:
      layout: "post"
      author: "Your Name"
  - scope:
      path: ""
      type: "tutorials"
    values:
      layout: "tutorial"

# Custom variables
show_excerpts: true
show_author: true
show_date: true
```

---

## 📚 Resources

**Theme Galleries:**
- GitHub Pages Themes: https://pages.github.com/themes/
- Jekyll Themes: http://jekyllthemes.org/
- Jekyll Themes Gallery: https://jekyllthemes.io/

**Documentation:**
- Jekyll Docs: https://jekyllrb.com/docs/
- Liquid Syntax: https://shopify.github.io/liquid/
- Front Matter: https://jekyllrb.com/docs/front-matter/

**Inspiration:**
- GitHub Explore: https://github.com/explore
- Jekyll Showcase: https://jekyllrb.com/showcase/

---

**Commit and push any changes to automatically rebuild your blog!** 🎨