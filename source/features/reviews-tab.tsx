import React from 'dom-chef';
import {CachedFunction} from 'webext-storage-cache';
import {$, elementExists} from 'select-dom';
import ReviewIcon from 'octicons-plain-react/Review';
import elementReady from 'element-ready';
import * as pageDetect from 'github-url-detection';

import features from '../feature-manager.js';
import api from '../github-helpers/api.js';
import {cacheByRepo, triggerRepoNavOverflow} from '../github-helpers/index.js';
import SearchQuery from '../github-helpers/search-query.js';
import abbreviateNumber from '../helpers/abbreviate-number.js';
import {highlightTab, unhighlightTab} from '../helpers/dom-utils.js';

type Reviews = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  author: {
    login: string;
  };
};

async function fetchReviews(): Promise<Reviews[]> {
  const response = await fetch("https://www.safefly.azure.com/api/safeflyrequest/getAll/r2d/submitted", {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      authorization: "Bearer ",
      priority: "u=1, i",
      "request-id": "|bb639ea7c6b746668c8fd61f99c3a148.4a8392d50fc548eb",
      "sec-ch-ua": "\"Microsoft Edge\";v=\"129\", \"Not=A?Brand\";v=\"8\", \"Chromium\";v=\"129\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      traceparent: "00-bb639ea7c6b746668c8fd61f99c3a148-4a8392d50fc548eb-01",
      "x-correlation-id": "584e7858-0a3a-9108-d7c1-cb12f4076248",
      "x-orgname": "r2d?filter=default",
      cookie: "ai_user=",
      Referer: "https://www.safefly.azure.com/safe-fly-request/r2d?filter=default",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    body: null,
    method: "GET"
  });

  if (!response.ok) {
    throw new Error('Failed to fetch reviews');
  }

  return response.json();
}

async function addReviewsTab(): Promise<void> {
  const reviews = await fetchReviews();

  const reviewsTab = (
    <a href="#reviews" className="UnderlineNav-item" data-hotkey="g r">
      <ReviewIcon className="UnderlineNav-octicon d-none d-sm-inline" />
      <span data-content="Reviews">Reviews</span>
      <span className="Counter">{abbreviateNumber(reviews.length)}</span>
    </a>
  );

  const pullRequestsTab = await elementReady('a.UnderlineNav-item[data-hotkey="g p"]', {waitForChildren: false});
  if (pullRequestsTab) {
    pullRequestsTab.parentElement!.insertBefore(reviewsTab, pullRequestsTab.nextElementSibling);
  }

  triggerRepoNavOverflow();
}

async function displayReviews(): Promise<void> {
  const reviews = await fetchReviews();
  const reviewsContainer = document.createElement('div');
  reviewsContainer.className = 'reviews-container';

  for (const review of reviews) {
    const reviewElement = (
      <div className="review">
        <h3>{review.title}</h3>
        <p>{review.body}</p>
        <p>By {review.author.login} on {new Date(review.createdAt).toLocaleDateString()}</p>
      </div>
    );
    reviewsContainer.appendChild(reviewElement);
  }

  const repoContent = await elementReady('#repo-content-pjax-container', {waitForChildren: false});
  if (repoContent) {
    repoContent.innerHTML = '';
    repoContent.appendChild(reviewsContainer);
  }
}

function init(signal: AbortSignal): void {
  addReviewsTab();
  if (location.hash === '#reviews') {
    displayReviews();
  }
}

void features.add(import.meta.url, {
  include: [
    pageDetect.isRepo,
  ],
  init,
});
