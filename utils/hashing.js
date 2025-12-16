// import {createHmac} from 'crypto';
// import hash from 'bcryptjs';
// import  compare  from 'bcryptjs';
import bcrypt from 'bcrypt';
import {createHmac} from 'crypto'

const hashPassword=async(value,saltValue)=>{
    const salt = await bcrypt.genSalt(saltValue);
   const result = await bcrypt.hash(value, salt);
   return result;
}

const comparePassword=async(enteredPassword,password)=>{
    return await bcrypt.compare(enteredPassword, password);
}

const hmacProcess=(value,key)=>{
    const result = createHmac('sha256', key).update(value).digest('hex');
	return result;
}

export {
    hashPassword,
    comparePassword,
    hmacProcess,
}