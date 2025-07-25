const jwt = require('jsonwebtoken');

module.exports = (req,res,next)=>{
    
    const token = req.cookies.token;
    if(!token){
        req.auth = false;
        return next();
    }
    try{
        const decodeToken = jwt.verify(token, 'Iamgood');
        if(!decodeToken){
            console.log("Token verification failed");
            req.auth = false;
            return next();
        }
        req.auth = true;
        req.customerId = decodeToken.customerId;
        req.email = decodeToken.email;

        next();
    }
    catch(err){
        console.log("Error during token verification:");
        console.error("Authorization error:", err);
        req.auth = false;
        return next();
    }
}