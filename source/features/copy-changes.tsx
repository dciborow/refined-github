import React from 'dom-chef';
import delegate, {DelegateEvent} from 'delegate-it';
import * as pageDetect from 'github-url-detection';
import {stringToBase64} from 'uint8array-extras';

import features from '../feature-manager.js';
import api from '../github-helpers/api.js';
import showToast from '../github-helpers/toast.js';
import {getBranches} from '../github-helpers/pr-branches.js';
import getPrInfo from '../github-helpers/get-pr-info.js';
import observe from '../helpers/selector-observer.js';

async function getMergeBaseReference(): Promise<string> {
	const {base, head} = getBranches();
	const response = await api.v3(`compare/${base.relative}...${head.relative}`);
	return response.merge_base_commit.sha;
}

async function getHeadReference(): Promise<string> {
	const {base} = getBranches();
	const {headRefOid} = await getPrInfo(base.relative);
	return headRefOid;
}

async function getFile(filePath: string): Promise<string | undefined> {
	const ref = await getMergeBaseReference();
	const {textContent} = await api.v3(
		`contents/${filePath}?ref=${ref}`,
		{
			json: false,
			headers: {
				Accept: 'application/vnd.github.raw',
			},
		},
	);
	return textContent;
}

async function copyChanges(progress: (message: string) => void, originalFileName: string, newFileName: string): Promise<void> {
	const [headReference, file] = await Promise.all([
		getHeadReference(),
		getFile(originalFileName),
	]);

	const isNewFile = !file;
	const isRenamed = originalFileName !== newFileName;

	const contents = file ? stringToBase64(file) : '';
	const deleteNewFile = {deletions: [{path: newFileName}]};
	const restoreOldFile = {additions: [{path: originalFileName, contents}]};
	const fileChanges = isRenamed
		? {...restoreOldFile, ...deleteNewFile}
		: isNewFile
			? deleteNewFile
			: restoreOldFile;

	const {nameWithOwner, branch: prBranch} = getBranches().head;
	progress('Creating new branch…');

	const newBranchName = `${prBranch}-copy-${Date.now()}`;
	await api.v4(`
		mutation createBranch ($input: CreateRefInput!) {
			createRef(input: $input) {
				ref {
					name
				}
			}
		}
	`, {
		variables: {
			input: {
				repositoryNameWithOwner: nameWithOwner,
				name: `refs/heads/${newBranchName}`,
				oid: headReference,
			},
		},
	});

	progress('Committing changes…');
	await api.v4(`
		mutation commitChanges ($input: CreateCommitOnBranchInput!) {
			createCommitOnBranch(input: $input) {
				commit {
					oid
				}
			}
		}
	`, {
		variables: {
			input: {
				branch: {
					repositoryNameWithOwner: nameWithOwner,
					branchName: newBranchName,
				},
				expectedHeadOid: headReference,
				fileChanges,
				message: {
					headline: `Copy changes to ${originalFileName}`,
				},
			},
		},
	});

	progress('Creating pull request…');
	await api.v4(`
		mutation createPullRequest ($input: CreatePullRequestInput!) {
			createPullRequest(input: $input) {
				pullRequest {
					url
				}
			}
		}
	`, {
		variables: {
			input: {
				repositoryNameWithOwner: nameWithOwner,
				baseRefName: prBranch,
				headRefName: newBranchName,
				title: `Copy changes to ${originalFileName}`,
			},
		},
	});
}

async function handleClick(event: DelegateEvent<MouseEvent, HTMLButtonElement>): Promise<void> {
	const menuItem = event.delegateTarget;

	try {
		const [originalFileName, newFileName = originalFileName] = menuItem
			.closest('[data-path]')!
			.querySelector('.Link--primary')!
			.textContent
			.split(' → ');
		await showToast(async progress => copyChanges(progress!, originalFileName, newFileName), {
			message: 'Loading info…',
			doneMessage: 'Changes copied',
		});

		menuItem.closest('.file')!.remove();
	} catch (error) {
		features.log.error(import.meta.url, error);
	}
}

function add(editFile: HTMLAnchorElement): void {
	editFile.after(
		<button
			className="pl-5 dropdown-item btn-link rgh-copy-changes"
			role="menuitem"
			type="button"
		>
			Copy changes
		</button>,
	);
}

function init(signal: AbortSignal): void {
	observe('.js-file-header-dropdown a[aria-label^="Change this"]', add, {signal});

	delegate('.rgh-copy-changes', 'click', handleClick, {capture: true, signal});
}

void features.add(import.meta.url, {
	include: [
		pageDetect.isPRFiles,
	],
	init,
});
