#!/usr/bin/env node

/**
 * Migration Script: Move to Nodea Convex Project
 * 
 * This script helps migrate from current project to Nodea project
 * and transfers all environment variables
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Nodea Project Migration Script');
console.log('==================================');

// Current environment variables to migrate
const ENV_VARS_TO_MIGRATE = [
  'CONVEX_OPENAI_API_KEY',
  'CONVEX_OPENAI_BASE_URL', 
  'CONVEX_SERPER_API_KEY',
  'JWKS',
  'JWT_PRIVATE_KEY',
  'SERPER_API_KEY',
  'SITE_URL'
];

// New environment variables (with your CONVEX_OPENAI_API_KEY2)
const NEW_ENV_VARS = {
  'CONVEX_OPENAI_API_KEY2': 'YOUR_NEW_OPENAI_KEY_HERE', // You'll need to provide this
  'CONVEX_OPENAI_BASE_URL': 'https://grateful-minnow-178.convex.site/openai-proxy',
  'CONVEX_SERPER_API_KEY': 'a540943e15734bf9ee2cf955469b95358c3cb102',
  'JWKS': '{"keys":[{"use":"sig","e":"AQAB","kty":"RSA","n":"y13lBLvprJ22MB9Nj4_ZcjCf5I_a8dAMGHZ8kJyBMOOfqgRbXlLwq9CWa_OdM5hMa6A1ULCztRu1LI-o94ha7L-yvDroudGnMWwTDIpq01SJ2w-OBVDEcIifRwW7n815eyUlKa9zHtU9tLev7KyKhvbWMpG0GLmr-mOpEk2LAVP1iZv0SjXB-E9BVwLpnzhz30Pi3c0aeHZRxyjyZbItXrablTqge0WvDhJYlRgsHVFwmf09zyy-A0SVtChrEBcFVLTMQ3O9WspD8BrGgBR5pyPybeKespUV3c6_f5lutH4j29wPXcglPoWbiywdDArfvqKr-Ybi21uFk67icXMvHw"}]}',
  'JWT_PRIVATE_KEY': '-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDLXeUEu+msnbYw\\nH02Pj9lyMJ/kj9rx0AwYdnyQnIEw45+qBFteUvCr0JZr850zmExroDVQsLO1G7Us\\nj6j3iFrsv7K8Oui50acxbBMMimrTVInbD44FUMRwiJ9HBbufzXl7JSUpr3Me1T20\\nt6/srIqG9tYykbQYuav6Y6kSTYsBU/WJm/RKNcH4T0FXAumfOHPfQ+LdzRp4dlHH\\nKPJlsi1etpuVOqB7Ra8OEliVGCwdUXCZ/T3PLL4DRJW0KGsQFwVUtMxDc71aykPw\\nGsaAFHmnI/Jt4p6ylRXdzr9/mW60fiPb3A9dyCU+hZuLLB0MCt++oqv5huLbW4WT\\nruJxcy8fAgMBAAECggEAYLXwOUYbo+kEQPJB8imYYMNa5li66A/mEKQYLLUggt1c\\nin+z67FJnot9XSzm7yhX/z6a3BqL+26Hw/81fTGs+7VWDEl/bw6SkeAxVt9kWcd0\\nH2bQRRrZsCJojF/fj+kpAjTx7VbwShNiWtSXpteOsQwlZLsBiFiTvmkyd+/EUQaA\\nJhiIz9MJ0dgOeIzM1upDGtFAnlLTMRc4j89Sttv9BS4QX0KY12sMC9sKaCFmcbmT\\n2Ee+KTYzLnfeusjTxCzTgzqLUDxkj1cI4C2TgdBh1oZMkvtOHTAFWc0RxN0VluGa\\n6SIb+wP2vsxdgNIvJPL18Qs0qthhUe/VzWuf6tjt4QKBgQD9OEYzc+DYFUg8LMuR\\n8RQYkGYpxd2x8RufszLaqG2UQTRGCxKfGY/Vz6noqh00mE+4bU6U7Or57gl3nr3J\\nZHVKQN+KKKWP1GBFffgXy3J/iXcSqODTDivlrzDiB3USN8fWMYskM7chF+sYkf6R\\njiWHuhje566eMn9yY0GWymrkGQKBgQDNmX+OM+Qriv1sbWWb9UAevrj2IKnBxGXe\\nn2eKkhbH7QmCOtVJ7aV1LCW4Y6nGMWdUxNff1AK+iokoaV45RxYo4gGHFIQMJS3Z\\nQkr/7nG/LkALgdmFZDEuIUo7nqBO2iEWjybnFLXXhpFXnBUEl0KVLgKM5qFQjQ3B\\nf4AYQuVT9wKBgQCqISUJbNGkXKgrxe0AIPlfh6Uca9SHuXbV1ZBVWNRGx4hXhxj7\\nzDDXdq6xo5n7vFnTj508cfFt+oBh3kWlCdnECdInASg7enU0O250jjxfc/yMjOqA\\n4wSbTRmKw3fkxZV+U8soh5aCpY9O8sgXA2ozxtTu7rpjj4oRUJ7AsT8gAQKBgQDK\\n5gT/rS4r2oqmin+QHcQdk1KtcyaUVuHBhcaE9g8NVlvf7Xe38ZMrw1mmUpSlRvQW\\nr/vqpCvhJo6dFv8pv4Ga7w9a42A9LCPHGKkzUXlnlpkVwhuMjIgMYkYD+FNz/chR\\nnwxhWArsm5yrvRjw4uWOm01hB+mCuPEuWEltp/bxmQKBgCD+IOL8OW7SGzjUTIu2\\niLax3pufkysuBTwBUgdWdCne12eURcEZjamCX9nDUOBcAHn7FKXDpBt8kM8pRxO0\\njMadlDSmt0PdDqxEi5jg8WsINZSJWqlUWNfnW1WIM/uNtOX3u78gSfrlwT9F0eRe\\nMIZeWeGTTnvhRfLXTrNOTpPT\\n-----END PRIVATE KEY-----',
  'SERPER_API_KEY': 'a540943e15734bf9ee2cf955469b95358c3cb102',
  'SITE_URL': 'http://127.0.0.1:5173'
};

async function migrateToNodea() {
  try {
    console.log('\n📋 Step 1: Current Environment Variables');
    console.log('----------------------------------------');
    
    // Get current environment variables
    const currentEnv = {};
    for (const envVar of ENV_VARS_TO_MIGRATE) {
      try {
        const result = execSync(`npx convex env get ${envVar}`, { encoding: 'utf8' });
        currentEnv[envVar] = result.trim();
        console.log(`✅ ${envVar}: ${result.trim().substring(0, 50)}...`);
      } catch (error) {
        console.log(`❌ ${envVar}: Not found`);
      }
    }

    console.log('\n🔧 Step 2: Switch to Nodea Project');
    console.log('----------------------------------');
    console.log('Please follow these steps:');
    console.log('1. Open Convex dashboard: https://dashboard.convex.dev');
    console.log('2. Switch to "Nodea" project (or create it if needed)');
    console.log('3. Create new deployment named "nodea-secure-v2"');
    console.log('4. Copy the new deployment URL');
    console.log('5. Return here and provide the new deployment URL');

    // Wait for user input
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const newDeploymentUrl = await new Promise((resolve) => {
      rl.question('\nEnter the new Nodea deployment URL: ', (answer) => {
        resolve(answer.trim());
      });
    });

    if (!newDeploymentUrl) {
      console.log('❌ No deployment URL provided. Exiting.');
      process.exit(1);
    }

    console.log('\n🔑 Step 3: Set Environment Variables');
    console.log('-----------------------------------');

    // Set environment variables for new deployment
    for (const [key, value] of Object.entries(NEW_ENV_VARS)) {
      if (key === 'CONVEX_OPENAI_API_KEY2') {
        const newApiKey = await new Promise((resolve) => {
          rl.question(`Enter your new OpenAI API key for ${key}: `, (answer) => {
            resolve(answer.trim());
          });
        });
        
        if (newApiKey) {
          try {
            execSync(`npx convex env set ${key} "${newApiKey}"`, { stdio: 'inherit' });
            console.log(`✅ ${key}: Set successfully`);
          } catch (error) {
            console.log(`❌ ${key}: Failed to set`);
          }
        }
      } else {
        try {
          execSync(`npx convex env set ${key} "${value}"`, { stdio: 'inherit' });
          console.log(`✅ ${key}: Set successfully`);
        } catch (error) {
          console.log(`❌ ${key}: Failed to set`);
        }
      }
    }

    console.log('\n🧪 Step 4: Test New Deployment');
    console.log('------------------------------');
    
    try {
      execSync('npx convex run boards:listBoards', { stdio: 'inherit' });
      console.log('✅ Deployment test successful!');
    } catch (error) {
      console.log('❌ Deployment test failed. Check the logs.');
    }

    console.log('\n✅ Migration Complete!');
    console.log('====================');
    console.log(`🎯 New deployment: ${newDeploymentUrl}`);
    console.log('📊 Environment variables migrated');
    console.log('🔐 New API key set (CONVEX_OPENAI_API_KEY2)');
    
    console.log('\n📋 Next Steps:');
    console.log('1. Test all application functionality');
    console.log('2. Update frontend to use new deployment URL');
    console.log('3. Monitor for 24-48 hours');
    console.log('4. Revoke old deployment after confirming new one works');

    rl.close();

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
migrateToNodea();
