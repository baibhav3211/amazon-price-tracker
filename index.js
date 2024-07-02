require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

const loadUrlFromFile = (filePath) => {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const urlsObject = JSON.parse(fileContent);
        return urlsObject;
    } catch (error) {
        console.error(`Error reading the URLs from file: ${error.message}`);
        return null;
    }
};

const getPriceFromAmazon = async (urlsObject) => {
    const prices = {};

    for (const key in urlsObject) {
        const url = urlsObject[key];

        try {
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            
            const price = $('.a-price-whole').first().text().trim();
            
            if (!price) {
                throw new Error('Price not found');
            }

            prices[key] = { price, url };
        } catch (error) {
            console.error(`Error fetching the price for ${key}: ${error.message}`);
            prices[key] = { price: 'Price not found', url };
        }
    }

    return prices;
};

const sendEmail = async (prices) => {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    let emailContent = 'Here are the prices for the requested products:\n\n';
    for (const key in prices) {
        emailContent += `${key}: ${prices[key].price}\nLink: ${prices[key].url}\n\n`;
    }

    let mailOptions = {
        from: `"Price Checker" <${process.env.EMAIL}>`,
        to: 'vibespen@gmail.com',
        subject: 'Amazon Product Prices',
        text: emailContent
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
    } catch (error) {
        console.error('Error sending email: ' + error.message);
    }
};

const fetchPricesAndSendEmail = async () => {
    const urlsObject = loadUrlFromFile('./urls.json');

    if (urlsObject) {
        const prices = await getPriceFromAmazon(urlsObject);
        for (const key in prices) {
            console.log(`Price for ${key}: ${prices[key].price}`);
        }

        await sendEmail(prices);
    }
};

// Schedule the job to run daily at 9:00 AM
cron.schedule('45 9 * * *', () => {
    console.log('Fetching prices and sending email...');
    fetchPricesAndSendEmail();
});
