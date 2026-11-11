"""
Demo: Company Classification Scanner
Run:  python -m company_classifier.demo
      python company_classifier/demo.py
"""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from company_classifier.pipeline import CompanyClassificationPipeline, Company

# ---------------------------------------------------------------------------
# Simulated LinkedIn job listings
# ---------------------------------------------------------------------------

SAMPLE_LINKEDIN_JOBS = [
    {
        "title": "Senior Software Engineer",
        "company_name": "Google",
        "company_description": "Google builds products and services to organize the world's information.",
        "industry": "Technology",
        "company_website": "google.com",
    },
    {
        "title": "Backend Engineer",
        "company_name": "Amazon",
        "company_description": "Amazon is guided by four principles: customer obsession, passion for invention, commitment to operational excellence, and long-term thinking.",
        "industry": "E-Commerce, Cloud Computing",
        "company_website": "amazon.com",
    },
    {
        "title": "Full Stack Developer",
        "company_name": "TekSystems",
        "company_description": "TEKsystems is a leading provider of business and technology staffing and services. We partner with our clients to staff and solve technology challenges.",
        "industry": "Staffing & Recruiting",
        "company_website": "teksystems.com",
    },
    {
        "title": "DevOps Engineer",
        "company_name": "Randstad",
        "company_description": "Randstad is a global leader in the HR services industry. We specialize in placing candidates with client organizations worldwide.",
        "industry": "Staffing & Recruiting",
        "company_website": "randstad.com",
    },
    {
        "title": "Platform Engineer",
        "company_name": "Atlassian",
        "company_description": "Atlassian makes software and tools that help every team unleash their full potential. Our products include Jira, Confluence, Trello, and Bitbucket.",
        "industry": "Software",
        "company_website": "atlassian.com",
    },
    {
        "title": "Solutions Architect",
        "company_name": "Accenture",
        "company_description": "Accenture is a global professional services company providing consulting, technology and outsourcing services.",
        "industry": "IT Services and IT Consulting",
        "company_website": "accenture.com",
    },
    {
        "title": "ML Engineer",
        "company_name": "DataBridge Talent Solutions",
        "company_description": "DataBridge Talent Solutions specializes in talent acquisition for data science and machine learning roles. We partner with companies to find the best candidates.",
        "industry": "Staffing & Recruiting",
        "company_website": "databridgetalent.com",
    },
    {
        "title": "Frontend Developer",
        "company_name": "Stripe",
        "company_description": "Stripe is a technology company that builds economic infrastructure for the internet. Businesses of every size use our software and APIs to accept payments.",
        "industry": "Financial Technology",
        "company_website": "stripe.com",
    },
    {
        "title": "Software Engineer",
        "company_name": "ManpowerGroup",
        "company_description": "ManpowerGroup is the world's workforce expert, connecting human potential to the power of business. We provide workforce solutions and staffing services.",
        "industry": "Human Resources",
        "company_website": "manpowergroup.com",
    },
    {
        "title": "Security Engineer",
        "company_name": "Cloudflare",
        "company_description": "Cloudflare is building the next generation of the global network. Our platform protects and accelerates any Internet application online.",
        "industry": "Cloud Security",
        "company_website": "cloudflare.com",
    },
    {
        "title": "Data Engineer",
        "company_name": "Infosys",
        "company_description": "Infosys is a global leader in next-generation digital services and consulting. We enable clients to navigate their digital transformation.",
        "industry": "IT Services",
        "company_website": "infosys.com",
    },
    {
        "title": "iOS Developer",
        "company_name": "ApexStaffing Pro",
        "company_description": "ApexStaffing Pro provides contract staffing, direct hire, and executive search services across the technology sector.",
        "industry": "Staffing",
        "company_website": "apexstaffingpro.com",
    },
]


def run_demo():
    print("=" * 60)
    print("  Company Classification Scanner — Demo")
    print("=" * 60)
    print(f"Processing {len(SAMPLE_LINKEDIN_JOBS)} LinkedIn job listings...")
    print("  (HuggingFace model disabled for demo speed — keyword + cache only)\n")

    pipeline = CompanyClassificationPipeline(
        use_hf=False,    # set True to enable facebook/bart-large-mnli
        use_agent=False, # set True to enable LLM agent fallback
    )

    # Process all jobs
    buckets = pipeline.process_linkedin_jobs(SAMPLE_LINKEDIN_JOBS)
    pipeline.print_summary(buckets)

    # Show filtered product-only list
    product_names = pipeline.get_product_companies(SAMPLE_LINKEDIN_JOBS)
    print("Product companies (safe to apply):")
    for name in product_names:
        print(f"  → {name}")

    # Show filtered job list (recruitment removed)
    filtered_jobs = pipeline.filter_out_recruitment(SAMPLE_LINKEDIN_JOBS)
    removed = len(SAMPLE_LINKEDIN_JOBS) - len(filtered_jobs)
    print(f"\nFiltered job listings: {len(filtered_jobs)} kept, {removed} recruitment firms removed.")

    pipeline.save_cache()
    return buckets


if __name__ == "__main__":
    run_demo()
