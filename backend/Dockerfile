# Use Node.js 20 LTS
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Expose the backend port
EXPOSE 5000

# Start the server
CMD [ "node", "index.js" ]
