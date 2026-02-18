# Google Cloud Run Deployment Setup Guide

This guide will help you set up the necessary infrastructure on Google Cloud and configure GitHub to deploy your `neon-tactics-3d` application automatically.

## Prerequisites

- A Google Cloud Platform (GCP) Account.
- Access to the GitHub repository settings.

## Step 1: Google Cloud Setup

1.  **Create a Project**:
    - Go to the [Google Cloud Console](https://console.cloud.google.com/).
    - Create a new project (e.g., `neon-tactics-prod`).
    - Note down the **Project ID** (this is different from the Project Name).

2.  **Enable APIs**:
    - Verify that billing is enabled for your project.
    - Search for and enable the following APIs:
        - **Cloud Run Admin API**
        - **Artifact Registry API**
        - **Cloud Build API** (optional, but often helpful)

3.  **Create Artifact Registry Repository**:
    - Go to **Artifact Registry** in the console.
    - Click **Create Repository**.
    - **Name**: `neon-tactics-3d` (Must match `REPO_NAME` in `.github/workflows/deploy.yml`).
    - **Format**: `Docker`.
    - **Region**: `us-central1` (Must match `REGION` in `.github/workflows/deploy.yml`).
    - Click **Create**.

4.  **Create Service Account**:
    - Go to **IAM & Admin** > **Service Accounts**.
    - Click **Create Service Account**.
    - **Name**: `github-deployer`.
    - Click **Create and Continue**.
    - **Grant Roles**:
        - `Cloud Run Admin` (to deploy services)
        - `Artifact Registry Writer` (to push images)
        - `Service Account User` (to act as the service account)
    - Click **Done**.

5.  **Generate Key**:
    - Click on the newly created service account (email address).
    - Go to the **Keys** tab.
    - Click **Add Key** > **Create new key**.
    - Select **JSON** and create.
    - **Save the downloaded file securely.** This contains your credentials.

## Step 2: GitHub Configuration

1.  **Add Secrets**:
    - Go to your GitHub repository -> **Settings** -> **Secrets and variables** -> **Actions**.
    - Click **New repository secret**.
    - Add the following secrets:
        - **Secret 1**:
            - **Name**: `GCP_PROJECT_ID`
            - **Secret**: `my-personal-221111` (This is your Project ID)
        - **Secret 2**:
            - **Name**: `GCP_SA_KEY`
            - **Secret**: Paste the entire content of the JSON key file you downloaded (starts with `{` and ends with `}`).

## Step 3: Invite Your Friend

To allow your friend to deploy using the button:

1.  Go to your GitHub repository -> **Settings** -> **Collaborators**.
2.  Click **Add people**.
3.  Enter your friend's GitHub username or email and invite them.
4.  Once they accept, they can go to the **Actions** tab in the repository.
5.  Select **Build and Deploy to Cloud Run** on the left.
6.  Click **Run workflow** dropdown and verify the branch (usually `main`).
7.  Click the green **Run workflow** button.

## Step 4: First Deployment

1.  Commit and push the `.github/workflows/deploy.yml` file to `main`.
2.  This should trigger the first deployment automatically.
3.  Check the **Actions** tab to watch the progress.
4.  Once finished, the URL of your app will be printed in the logs of the "Show Output" step.

## Troubleshooting

-   **Permission Denied**: Check that the Service Account has all the required roles (`Cloud Run Admin`, `Artifact Registry Writer`, `Service Account User`).
-   **API Not Enabled**: Ensure Cloud Run and Artifact Registry APIs are enabled in your project.
-   **Region Mismatch**: Ensure the region in `deploy.yml` (`us-central1`) matches where you created your Artifact Registry repository.
