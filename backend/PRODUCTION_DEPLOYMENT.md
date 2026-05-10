# 🚀 Production Deployment Guide

## Phase 1: Pre-Deployment Checklist (TODAY)

### Security ✅
- [ ] Rotated JWT_SECRET (generate new one)
- [ ] Updated MongoDB credentials in MONGODB_URI
- [ ] Changed ADMIN_PASSWORD to 12+ characters
- [ ] Verified `.env` is in `.gitignore`
- [ ] Removed any secrets from code comments
- [ ] Ran `npm install` in backend (installs winston + joi)

### Testing
- [ ] Tested login endpoint (rate limiting kicks in after 5 attempts)
- [ ] Tested booking creation (rate limiting kicks in after 30 attempts)
- [ ] Checked logs are being written to `backend/logs/`
- [ ] Frontend API timeouts work (test by stopping backend)
- [ ] Verified CORS - request from different domain should fail

### Configuration
- [ ] Set `FRONTEND_URL` to your actual production domain
- [ ] Set `NODE_ENV=production` (disables debug logging)
- [ ] Created `backend/logs` directory
- [ ] Verified all env vars are set correctly

---

## Phase 2: Hosting Setup (NEXT STEP)

### Option A: Heroku (Easiest)
```bash
# Install Heroku CLI
# Login: heroku login
# Create app: heroku create moveon-api

# Set environment variables
heroku config:set JWT_SECRET="your-secret"
heroku config:set MONGODB_URI="your-uri"
heroku config:set NODE_ENV=production
heroku config:set FRONTEND_URL=https://yourdomain.com
heroku config:set LOG_LEVEL=info

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Option B: AWS EC2 + PM2
```bash
# SSH into EC2 instance
ssh -i key.pem ec2-user@your-instance-ip

# Install Node.js 18+
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Clone repo
git clone your-repo
cd bus-tracker/backend

# Install dependencies
npm install --production

# Install PM2
sudo npm install -g pm2

# Start with PM2
pm2 start server.js --name "moveon-api"
pm2 startup
pm2 save

# Install Nginx (reverse proxy)
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Configure Nginx (edit /etc/nginx/nginx.conf)
# Point to localhost:3001
```

### Option C: Docker + Kubernetes
```bash
# Create Dockerfile (already provided)
docker build -t moveon-api:latest .
docker run -p 3001:3001 --env-file .env moveon-api:latest

# Push to Docker Hub
docker tag moveon-api:latest yourusername/moveon-api:latest
docker push yourusername/moveon-api:latest

# Deploy to Kubernetes
kubectl apply -f deployment.yaml
```

---

## Phase 3: Monitoring & Alerts

### Logs
- **Check logs:** `tail -f backend/logs/error.log`
- **Clear logs:** `rm backend/logs/*.log`
- **Rotate logs:** Set up logrotate on Linux

### Database Backups
```bash
# Backup MongoDB
mongodump --uri "mongodb+srv://..." --out ./backup

# Restore
mongorestore ./backup
```

### Uptime Monitoring
- Use Uptime Robot (free tier available)
- Monitor `/health` endpoint: `GET http://yourdomain/api/health`
- Alert on response time > 2 seconds

### Performance Monitoring (Optional)
- **APM Tool:** Datadog, New Relic, or Sentry
- **Error Tracking:** Sentry for unhandled errors
- **Status Page:** Use Statuspage.io to inform users

---

## Phase 4: Security Hardening

### SSL/HTTPS
```bash
# Use Let's Encrypt with Certbot
sudo certbot certonly --standalone -d yourdomain.com
sudo systemctl restart nginx
```

### WAF (Web Application Firewall)
- Enable Cloudflare free tier (free DDoS protection)
- Set up rate limiting at CDN level

### Environment Security
```bash
# Use AWS Secrets Manager for secrets rotation
# Example: Node.js library aws-sdk can load secrets
```

### Database Security
- Enable MongoDB Atlas IP whitelisting
- Use strong database password (30+ chars)
- Enable database encryption at rest

---

## Phase 5: Scaling

### Load Balancing
- Use AWS ALB (Application Load Balancer)
- Deploy multiple API instances behind load balancer

### Caching
- Add Redis for session caching
- Cache fare calculations

### Database Scaling
- Enable MongoDB sharding if > 10GB data
- Set up read replicas for analytics

---

## 🆘 Troubleshooting

### API won't start
```bash
# Check if MONGODB_URI is set
echo $MONGODB_URI

# Check if port 3001 is free
netstat -an | grep 3001

# Check logs
cat backend/logs/error.log
```

### High memory usage
```bash
# Increase Node.js heap size
NODE_OPTIONS="--max-old-space-size=512" npm start

# Check for memory leaks in logs
grep -i "leak" backend/logs/combined.log
```

### Database connection errors
```bash
# Test MongoDB connection
mongosh "your-connection-string"

# Check MongoDB Atlas firewall whitelist
# Add your server IP to IP whitelist
```

### Rate limiting too strict
- Adjust limits in `backend/utils/rateLimiter.js`
- Different limits for different endpoints

---

## 📞 Emergency Contacts

- **MongoDB Status:** https://status.cloud.mongodb.com
- **Heroku Status:** https://status.heroku.com
- **AWS Status:** https://status.aws.amazon.com

---

## Next Steps

1. ✅ Complete Phase 1 checklist TODAY
2. ⏳ Choose hosting provider (Phase 2)
3. 🚀 Deploy to production
4. 📊 Set up monitoring (Phase 3)
5. 🔒 Implement security hardening (Phase 4)

**Estimated Time to Production: 2-4 hours**
