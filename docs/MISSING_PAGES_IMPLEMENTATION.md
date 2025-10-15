// Missing Pages Implementation

// About Page
export const AboutPage = () => {
  return (
    <div className="about-page">
      <div className="container">
        <h1>About SichrPlace</h1>
        
        <section className="mission">
          <h2>Our Mission</h2>
          <p>
            SichrPlace revolutionizes apartment hunting in Germany by providing a secure, 
            professional platform that connects tenants and landlords with complete transparency 
            and expert support throughout the entire rental process.
          </p>
        </section>
        
        <section className="how-it-works">
          <h2>How We Work</h2>
          <div className="process-steps">
            <div className="step">
              <h3>Professional Viewings</h3>
              <p>Our trained professionals conduct all property viewings, ensuring safety and providing detailed video documentation.</p>
            </div>
            <div className="step">
              <h3>Secure Payments</h3>
              <p>All transactions are processed through our secure PayPal integration with full buyer protection.</p>
            </div>
            <div className="step">
              <h3>Expert Support</h3>
              <p>From initial search to contract signing, our team provides guidance at every step.</p>
            </div>
          </div>
        </section>
        
        <section className="team">
          <h2>Our Team</h2>
          <p>
            Founded by rental market experts, SichrPlace combines technology with human expertise 
            to create the most trusted apartment rental platform in Germany.
          </p>
        </section>
      </div>
    </div>
  );
};

// FAQ Page
export const FAQPage = () => {
  const faqs = [
    {
      question: "How does SichrPlace work?",
      answer: "SichrPlace connects tenants and landlords through a secure platform. You can search for apartments, request viewings conducted by our professionals, and complete the entire rental process with our support."
    },
    {
      question: "Are the viewings really conducted by professionals?",
      answer: "Yes, all property viewings are conducted by our trained team members. We provide detailed video documentation and professional assessment of each property."
    },
    {
      question: "How secure are the payments?",
      answer: "All payments are processed through PayPal's secure payment system with full buyer protection. We never store payment information on our servers."
    },
    {
      question: "What areas do you cover?",
      answer: "We currently operate in major German cities including Berlin, Munich, Hamburg, Frankfurt, and Stuttgart, with plans to expand to more cities."
    },
    {
      question: "How much does it cost?",
      answer: "Our basic search and browsing services are free. We charge a small service fee only when you successfully secure an apartment through our platform."
    },
    {
      question: "Can I trust the landlords on your platform?",
      answer: "All landlords are verified through our screening process. We also provide ratings and reviews from previous tenants to help you make informed decisions."
    }
  ];

  return (
    <div className="faq-page">
      <div className="container">
        <h1>Frequently Asked Questions</h1>
        
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </div>
          ))}
        </div>
        
        <section className="contact-support">
          <h2>Still have questions?</h2>
          <p>Contact our customer service team for personalized assistance.</p>
          <Link to="/customer-service" className="contact-button">
            Contact Support
          </Link>
        </section>
      </div>
    </div>
  );
};

// Customer Service Page
export const CustomerServicePage = () => {
  return (
    <div className="customer-service-page">
      <div className="container">
        <h1>Customer Service</h1>
        
        <div className="service-options">
          <div className="contact-methods">
            <h2>Get in Touch</h2>
            
            <div className="contact-method">
              <h3>📧 Email Support</h3>
              <p>support@sichrplace.com</p>
              <p>Response time: Within 24 hours</p>
            </div>
            
            <div className="contact-method">
              <h3>📞 Phone Support</h3>
              <p>+49 (0) 30 1234 5678</p>
              <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
            </div>
            
            <div className="contact-method">
              <h3>💬 Live Chat</h3>
              <p>Available on our website</p>
              <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
            </div>
          </div>
          
          <div className="support-categories">
            <h2>How Can We Help?</h2>
            
            <div className="category">
              <h3>Account Issues</h3>
              <ul>
                <li>Registration problems</li>
                <li>Login difficulties</li>
                <li>Profile updates</li>
                <li>Email verification</li>
              </ul>
            </div>
            
            <div className="category">
              <h3>Property Search</h3>
              <ul>
                <li>Search filters help</li>
                <li>Property recommendations</li>
                <li>Saved searches</li>
                <li>Alert notifications</li>
              </ul>
            </div>
            
            <div className="category">
              <h3>Viewing Process</h3>
              <ul>
                <li>Scheduling viewings</li>
                <li>Viewing reports</li>
                <li>Video documentation</li>
                <li>Follow-up questions</li>
              </ul>
            </div>
            
            <div className="category">
              <h3>Payments & Contracts</h3>
              <ul>
                <li>Payment issues</li>
                <li>Receipt requests</li>
                <li>Contract assistance</li>
                <li>Dispute resolution</li>
              </ul>
            </div>
          </div>
        </div>
        
        <section className="emergency-contact">
          <h2>Emergency Support</h2>
          <p>For urgent issues during viewings or emergencies:</p>
          <p><strong>Emergency Hotline: +49 (0) 30 1234 9999</strong></p>
          <p>Available 24/7</p>
        </section>
      </div>
    </div>
  );
};

// Marketplace Page (Restored)
export const MarketplacePage = () => {
  return (
    <div className="marketplace-page">
      <div className="container">
        <h1>SichrPlace Marketplace</h1>
        
        <div className="marketplace-sections">
          <section className="featured-properties">
            <h2>Featured Properties</h2>
            <p>Handpicked apartments from verified landlords</p>
            {/* Property grid component */}
          </section>
          
          <section className="recent-listings">
            <h2>Recently Added</h2>
            <p>Fresh properties just added to our platform</p>
            {/* Recent listings component */}
          </section>
          
          <section className="popular-areas">
            <h2>Popular Areas</h2>
            <div className="areas-grid">
              <Link to="/search?city=Berlin" className="area-card">
                <h3>Berlin</h3>
                <p>1,234 properties</p>
              </Link>
              <Link to="/search?city=Munich" className="area-card">
                <h3>Munich</h3>
                <p>856 properties</p>
              </Link>
              <Link to="/search?city=Hamburg" className="area-card">
                <h3>Hamburg</h3>
                <p>642 properties</p>
              </Link>
            </div>
          </section>
          
          <section className="marketplace-tools">
            <h2>Marketplace Tools</h2>
            <div className="tools-grid">
              <Link to="/search" className="tool-card">
                <h3>Advanced Search</h3>
                <p>Find your perfect apartment with detailed filters</p>
              </Link>
              <Link to="/post" className="tool-card">
                <h3>List Property</h3>
                <p>Advertise your apartment to verified tenants</p>
              </Link>
              <Link to="/saved" className="tool-card">
                <h3>Saved Properties</h3>
                <p>Manage your favorite apartments and searches</p>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// Updated Login Page Description
export const LoginPage = () => {
  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Sign Into Your SichrPlace Account</h1>
        <p>Access your apartment search dashboard and manage your property preferences</p>
        
        <form className="login-form">
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" required />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input type="password" required />
          </div>
          
          <button type="submit" className="login-button">
            Sign In
          </button>
          
          <div className="login-links">
            <Link to="/forgot-password">Forgot Password?</Link>
            <Link to="/register">Create New Account</Link>
          </div>
        </form>
      </div>
    </div>
  );
};